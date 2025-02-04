import app from 'flarum/common/app';
import Button from 'flarum/common/components/Button';
import saveSettings from 'flarum/admin/utils/saveSettings';
import Alert from 'flarum/common/components/Alert';
import Select from 'flarum/common/components/Select';
import Switch from 'flarum/common/components/Switch';
import UploadImageButton from 'flarum/admin/components/UploadImageButton';
import withAttr from 'flarum/common/utils/withAttr';
import Stream from 'flarum/common/utils/Stream';
import ExtensionPage from 'flarum/admin/components/ExtensionPage';
import ItemList from 'flarum/common/utils/ItemList';

/* global m */

export default class UploadPage extends ExtensionPage {
    oninit(vnode) {
        super.oninit(vnode);
        // whether we are saving the settings or not right now
        this.loading = false;

        // the fields we need to watch and to save
        this.fields = [
            // image
            'resizeMaxWidth',
            'cdnUrl',
            'maxFileSize',
            'whitelistedClientExtensions',
            'composerButtonVisiblity',
            'encodeImageType',
            'encodeQuality',
            // watermark
            'watermark',
            'watermarkPosition',
            // Imgur
            'imgurClientId',
            // AWS
            'awsS3Key',
            'awsS3Secret',
            'awsS3Bucket',
            'awsS3Region',
            'awsS3Endpoint',
            'awsS3ACL',
            // GCS
            'gcsProjectId',
            'gcsBucketName',
            'gcsPrivateKeyId',
            'gcsPrivateKey',
            'gcsClientEmail',
            'gcsClientId',
            'gcsAuthUri',
            'gcsTokenUri',
            'gcsAuthProviderX509CertUrl',
            'gcsClientX509CertUrl',
            'gcsUploadPrefix',
            // QIniu
            'qiniuKey',
            'qiniuSecret',
            'qiniuBucket',
        ];

        // the checkboxes we need to watch and to save.
        this.checkboxes = ['mustResize', 'addsWatermarks', 'disableHotlinkProtection', 'disableDownloadLogging', 'awsS3UsePathStyleEndpoint', 'mustEncode'];

        // fields that are objects
        this.objects = ['mimeTypes'];

        // watermark positions
        this.watermarkPositions = {
            'top-left': 'top-left',
            'top-right': 'top-right',
            'bottom-left': 'bottom-left',
            'bottom-right': 'bottom-right',
            center: 'center',
            left: 'left',
            top: 'top',
            right: 'right',
            bottom: 'bottom',
        };

        // Composer button options
        this.composerButtonVisiblityOptions = {
            both: app.translator.trans('fof-upload.admin.labels.composer_buttons.options.both'),
            'upload-btn': app.translator.trans('fof-upload.admin.labels.composer_buttons.options.upload-btn'),
            'media-btn': app.translator.trans('fof-upload.admin.labels.composer_buttons.options.media-btn'),
        };

        // Encode button options
        this.encodeTypeOptions = {
            jpg: app.translator.trans('fof-upload.admin.labels.encode_buttons.options.jpg'),
            'webp': app.translator.trans('fof-upload.admin.labels.encode_buttons.options.webp'),
        };

        // get the saved settings from the database
        const settings = app.data.settings;

        // our package prefix (to be added to every field and checkbox in the setting table)
        this.settingsPrefix = 'fof-upload';

        // Options for the Upload methods dropdown menu.
        this.uploadMethodOptions = settings[this.addPrefix('availableUploadMethods')] || {};
        // Options for the Template dropdown menu.
        this.templateOptions = settings[this.addPrefix('availableTemplates')] || {};
        // Contains current values.
        this.values = {};
        // bind the values of the fields and checkboxes to the getter/setter functions
        this.fields.forEach((key) => (this.values[key] = Stream(settings[this.addPrefix(key)])));
        this.checkboxes.forEach((key) => (this.values[key] = Stream(settings[this.addPrefix(key)] === '1')));
        this.objects.forEach(
            (key) => (this.values[key] = settings[this.addPrefix(key)] ? Stream(JSON.parse(settings[this.addPrefix(key)])) : Stream())
        );

        // Set a sane default in case no mimeTypes have been configured yet.
        // Since 'local' (or others) can now be disabled, pick the last entry in the object for default
        this.defaultAdap = Object.keys(this.uploadMethodOptions)[Object.keys(this.uploadMethodOptions).length - 1];
        this.values.mimeTypes() ||
            (this.values.mimeTypes = Stream({
                '^image\\/.*': {
                    adapter: this.defaultAdap,
                    template: 'image-preview',
                },
            }));

        this.newMimeType = {
            regex: Stream(''),
            adapter: Stream(this.defaultAdap),
            template: Stream('file'),
        };
    }

    /**
     * Show the actual ImageUploadPage.
     *
     * @returns {*}
     */
    content() {
        return [
            m('.UploadPage', [
                m('.container', [
                    m(
                        'form',
                        {
                            onsubmit: this.onsubmit.bind(this),
                        },
                        [
                            m('fieldset', [
                                m('legend', app.translator.trans('fof-upload.admin.labels.preferences.title')),
                                m('label', app.translator.trans('fof-upload.admin.labels.preferences.max_file_size')),
                                m('input.FormControl', {
                                    value: this.values.maxFileSize() || 2048,
                                    oninput: withAttr('value', this.values.maxFileSize),
                                    type: 'number',
                                    min: '0',
                                }),
                                m('label', app.translator.trans('fof-upload.admin.labels.preferences.mime_types')),
                                m(
                                    '.MimeTypes--Container',
                                    Object.keys(this.values.mimeTypes()).map((mime) => {
                                        let config = this.values.mimeTypes()[mime];
                                        // Compatibility for older versions.
                                        if (typeof config !== 'object') {
                                            config = {
                                                adapter: config,
                                                template: 'file',
                                            };
                                        }

                                        return m('div', [
                                            m('input.FormControl.MimeTypes', {
                                                value: mime,
                                                oninput: withAttr('value', this.updateMimeTypeKey.bind(this, mime)),
                                            }),
                                            Select.component({
                                                options: this.uploadMethodOptions,
                                                onchange: this.updateMimeTypeAdapter.bind(this, mime, config),
                                                value: config.adapter || 'local',
                                            }),
                                            Select.component({
                                                options: this.getTemplateOptionsForInput(),
                                                onchange: this.updateMimeTypeTemplate.bind(this, mime, config),
                                                value: config.template || 'local',
                                            }),
                                            Button.component(
                                                {
                                                    type: 'button',
                                                    className: 'Button Button--warning',
                                                    onclick: this.deleteMimeType.bind(this, mime),
                                                },
                                                'x'
                                            ),
                                        ]);
                                    }),
                                    m('br'),
                                    m('div', [
                                        m('input.FormControl.MimeTypes.add-MimeType-key', {
                                            value: this.newMimeType.regex(),
                                            oninput: withAttr('value', this.newMimeType.regex),
                                        }),
                                        Select.component({
                                            options: this.uploadMethodOptions,
                                            className: 'add-MimeType-value',
                                            oninput: withAttr('value', this.newMimeType.adapter),
                                            value: this.newMimeType.adapter(),
                                        }),
                                        Select.component({
                                            options: this.getTemplateOptionsForInput(),
                                            className: 'add-MimeType-value',
                                            oninput: withAttr('value', this.newMimeType.template),
                                            value: this.newMimeType.template(),
                                        }),
                                        Button.component(
                                            {
                                                type: 'button',
                                                className: 'Button Button--warning',
                                                onclick: this.addMimeType.bind(this),
                                            },
                                            '+'
                                        ),
                                    ])
                                ),
                                m('.helpText', app.translator.trans('fof-upload.admin.help_texts.mime_types')),
                                m('.helpText', app.translator.trans('fof-upload.admin.help_texts.download_templates')),
                                this.templateOptionsDescriptions(),
                            ]),
                            m('fieldset.composerButtons', [
                                m('legend', app.translator.trans('fof-upload.admin.labels.composer_buttons.title')),
                                m('.helpText', app.translator.trans('fof-upload.admin.help_texts.composer_buttons')),
                                m('div', [
                                    Select.component({
                                        options: this.composerButtonVisiblityOptions,
                                        onchange: this.values.composerButtonVisiblity,
                                        value: this.values.composerButtonVisiblity() || 'both',
                                    }),
                                ]),
                            ]),
                            m('fieldset', [
                                m('legend', app.translator.trans('fof-upload.admin.labels.resize.title')),
                                m('.helpText', app.translator.trans('fof-upload.admin.help_texts.resize')),
                                Switch.component(
                                    {
                                        state: this.values.mustResize() || false,
                                        onchange: this.values.mustResize,
                                    },
                                    app.translator.trans('fof-upload.admin.labels.resize.toggle')
                                ),
                                m('label', app.translator.trans('fof-upload.admin.labels.resize.max_width')),
                                m('input', {
                                    className: 'FormControl',
                                    value: this.values.resizeMaxWidth() || 100,
                                    oninput: withAttr('value', this.values.resizeMaxWidth),
                                    disabled: !this.values.mustResize(),
                                    type: 'number',
                                    min: '0',
                                }),
                            ]),
                            m('fieldset.encodeButtons', [
                                m('legend', app.translator.trans('fof-upload.admin.labels.encode.title')),
                                m('.helpText', app.translator.trans('fof-upload.admin.help_texts.encode')),
                                Switch.component(
                                    {
                                        state: this.values.mustEncode() || false,
                                        onchange: this.values.mustEncode,
                                    },
                                    app.translator.trans('fof-upload.admin.labels.encode.toggle')
                                ),
                                m('legend', app.translator.trans('fof-upload.admin.labels.encode_buttons.title')),
                                m('.helpText', app.translator.trans('fof-upload.admin.help_texts.encode_buttons')),
                                m('div', [
                                    Select.component({
                                        options: this.encodeTypeOptions,
                                        onchange: this.values.encodeImageType,
                                        value: this.values.encodeImageType() || 'jpg',
                                    }),
                                ]),
                                m('label', app.translator.trans('fof-upload.admin.labels.encode.quality')),
                                m('input', {
                                    className: 'FormControl',
                                    value: this.values.encodeQuality() || 90,
                                    oninput: withAttr('value', this.values.encodeQuality),
                                    disabled: !this.values.mustEncode(),
                                    type: 'number',
                                    min: '0',
                                    max: '100'
                                }),
                            ]),
                            m('fieldset', [
                                m('legend', app.translator.trans('fof-upload.admin.labels.client_extension.title')),
                                m('.helpText', app.translator.trans('fof-upload.admin.help_texts.client_extension')),
                                m('input', {
                                    className: 'FormControl',
                                    value: this.values.whitelistedClientExtensions() || '',
                                    oninput: withAttr('value', this.values.whitelistedClientExtensions),
                                }),
                            ]),
                            m('fieldset', [
                                m('legend', app.translator.trans('fof-upload.admin.labels.watermark.title')),
                                m('.helpText', app.translator.trans('fof-upload.admin.help_texts.watermark')),
                                Switch.component(
                                    {
                                        state: this.values.addsWatermarks() || false,
                                        onchange: this.values.addsWatermarks,
                                    },
                                    app.translator.trans('fof-upload.admin.labels.watermark.toggle')
                                ),
                                m('label', app.translator.trans('fof-upload.admin.labels.watermark.position')),
                                m('div', [
                                    Select.component({
                                        options: this.watermarkPositions,
                                        onchange: this.values.watermarkPosition,
                                        value: this.values.watermarkPosition() || 'bottom-right',
                                    }),
                                ]),
                                m('label', {}, app.translator.trans('fof-upload.admin.labels.watermark.file')),
                                UploadImageButton.component({
                                    name: 'fof/watermark',
                                }),
                            ]),
                            m('fieldset', [
                                m('legend', app.translator.trans('fof-upload.admin.labels.disable-hotlink-protection.title')),
                                m('.helpText', app.translator.trans('fof-upload.admin.help_texts.disable-hotlink-protection')),
                                Switch.component(
                                    {
                                        state: this.values.disableHotlinkProtection() || false,
                                        onchange: this.values.disableHotlinkProtection,
                                    },
                                    app.translator.trans('fof-upload.admin.labels.disable-hotlink-protection.toggle')
                                ),
                                m('legend', app.translator.trans('fof-upload.admin.labels.disable-download-logging.title')),
                                m('.helpText', app.translator.trans('fof-upload.admin.help_texts.disable-download-logging')),
                                Switch.component(
                                    {
                                        state: this.values.disableDownloadLogging() || false,
                                        onchange: this.values.disableDownloadLogging,
                                    },
                                    app.translator.trans('fof-upload.admin.labels.disable-download-logging.toggle')
                                ),
                            ]),
                            m('fieldset', [
                                m('legend', app.translator.trans('fof-upload.admin.labels.local.title')),
                                m('label', app.translator.trans('fof-upload.admin.labels.local.cdn_url')),
                                m('input.FormControl', {
                                    value: this.values.cdnUrl() || '',
                                    oninput: withAttr('value', this.values.cdnUrl),
                                }),
                            ]),

                            this.adaptorItems().toArray(),

                            Button.component(
                                {
                                    type: 'submit',
                                    className: 'Button Button--primary',
                                    loading: this.loading,
                                    disabled: !this.changed(),
                                },
                                app.translator.trans('fof-upload.admin.buttons.save')
                            ),
                        ]
                    ),
                ]),
            ]),
        ];
    }

    adaptorItems() {
        const items = new ItemList();

        if (this.uploadMethodOptions['imgur'] !== undefined) {
            items.add(
                'imgur',
                m('.imgur', [
                    m('fieldset', [
                        m('legend', app.translator.trans('fof-upload.admin.labels.imgur.title')),
                        m('label', app.translator.trans('fof-upload.admin.labels.imgur.client_id')),
                        m('input.FormControl', {
                            value: this.values.imgurClientId() || '',
                            oninput: withAttr('value', this.values.imgurClientId),
                        }),
                    ]),
                ])
            );
        }

        if (this.uploadMethodOptions['qiniu'] !== undefined) {
            items.add(
                'qiniu',
                m('.qiniu', [
                    m('fieldset', [
                        m('legend', app.translator.trans('fof-upload.admin.labels.qiniu.title')),
                        m('label', app.translator.trans('fof-upload.admin.labels.qiniu.key')),
                        m('input.FormControl', {
                            value: this.values.qiniuKey() || '',
                            oninput: withAttr('value', this.values.qiniuKey),
                        }),
                        m('label', {}, app.translator.trans('fof-upload.admin.labels.qiniu.secret')),
                        m('input.FormControl', {
                            value: this.values.qiniuSecret() || '',
                            oninput: withAttr('value', this.values.qiniuSecret),
                        }),
                        m('label', {}, app.translator.trans('fof-upload.admin.labels.qiniu.bucket')),
                        m('input.FormControl', {
                            value: this.values.qiniuBucket() || '',
                            oninput: withAttr('value', this.values.qiniuBucket),
                        }),
                    ]),
                ])
            );
        }

        if (this.uploadMethodOptions['aws-s3'] !== undefined) {
            items.add(
                'aws-s3',
                m('.aws', [
                    m('fieldset', [
                        m('legend', app.translator.trans('fof-upload.admin.labels.aws-s3.title')),
                        m('label', app.translator.trans('fof-upload.admin.labels.aws-s3.key')),
                        m('input.FormControl', {
                            value: this.values.awsS3Key() || '',
                            oninput: withAttr('value', this.values.awsS3Key),
                        }),
                        m('label', app.translator.trans('fof-upload.admin.labels.aws-s3.secret')),
                        m('input.FormControl', {
                            value: this.values.awsS3Secret() || '',
                            oninput: withAttr('value', this.values.awsS3Secret),
                        }),
                        m('label', app.translator.trans('fof-upload.admin.labels.aws-s3.bucket')),
                        m('input.FormControl', {
                            value: this.values.awsS3Bucket() || '',
                            oninput: withAttr('value', this.values.awsS3Bucket),
                        }),
                        m('label', app.translator.trans('fof-upload.admin.labels.aws-s3.region')),
                        m('input.FormControl', {
                            value: this.values.awsS3Region() || '',
                            oninput: withAttr('value', this.values.awsS3Region),
                        }),
                    ]),
                    m('fieldset', [
                        m('legend', app.translator.trans('fof-upload.admin.labels.aws-s3.advanced_title')),
                        m('.helpText', app.translator.trans('fof-upload.admin.help_texts.s3_compatible_storage')),
                        m('label', app.translator.trans('fof-upload.admin.labels.aws-s3.endpoint')),
                        m('input.FormControl', {
                            value: this.values.awsS3Endpoint() || '',
                            oninput: withAttr('value', this.values.awsS3Endpoint),
                        }),
                        Switch.component(
                            {
                                state: this.values.awsS3UsePathStyleEndpoint() || false,
                                onchange: this.values.awsS3UsePathStyleEndpoint,
                            },
                            app.translator.trans('fof-upload.admin.labels.aws-s3.use_path_style_endpoint')
                        ),
                        m('label', app.translator.trans('fof-upload.admin.labels.aws-s3.acl')),
                        m('input.FormControl', {
                            value: this.values.awsS3ACL() || '',
                            oninput: withAttr('value', this.values.awsS3ACL),
                        }),
                        m('.helpText', app.translator.trans('fof-upload.admin.help_texts.s3_acl')),
                    ]),
                ])
            );
        }

        if (this.uploadMethodOptions['gcs'] !== undefined) {
            items.add(
                'gcs',
                m('.gcs', [
                    m('fieldset', [
                        m('legend', app.translator.trans('fof-upload.admin.labels.gcs.title')),
                        m('label', app.translator.trans('fof-upload.admin.labels.gcs.project_id')),
                        m('input.FormControl', {
                            value: this.values.gcsProjectId() || '',
                            oninput: withAttr('value', this.values.gcsProjectId),
                        }),
                        m('label', app.translator.trans('fof-upload.admin.labels.gcs.bucket')),
                        m('input.FormControl', {
                            value: this.values.gcsBucketName() || '',
                            oninput: withAttr('value', this.values.gcsBucketName),
                        }),
                        m('label', app.translator.trans('fof-upload.admin.labels.gcs.private_key_id')),
                        m('input.FormControl', {
                            value: this.values.gcsPrivateKeyId() || '',
                            oninput: withAttr('value', this.values.gcsPrivateKeyId),
                        }),
                        m('label', app.translator.trans('fof-upload.admin.labels.gcs.private_key')),
                        m('input.FormControl', {
                            value: this.values.gcsPrivateKey() || '',
                            oninput: withAttr('value', this.values.gcsPrivateKey),
                        }),
                        m('label', app.translator.trans('fof-upload.admin.labels.gcs.client_email')),
                        m('input.FormControl', {
                            value: this.values.gcsClientEmail() || '',
                            oninput: withAttr('value', this.values.gcsClientEmail),
                        }),
                        m('label', app.translator.trans('fof-upload.admin.labels.gcs.client_id')),
                        m('input.FormControl', {
                            value: this.values.gcsClientId() || '',
                            oninput: withAttr('value', this.values.gcsClientId),
                        }),
                        m('label', app.translator.trans('fof-upload.admin.labels.gcs.auth_uri')),
                        m('input.FormControl', {
                            value: this.values.gcsAuthUri() || '',
                            oninput: withAttr('value', this.values.gcsAuthUri),
                        }),
                        m('label', app.translator.trans('fof-upload.admin.labels.gcs.token_uri')),
                        m('input.FormControl', {
                            value: this.values.gcsTokenUri() || '',
                            oninput: withAttr('value', this.values.gcsTokenUri),
                        }),
                        m('label', app.translator.trans('fof-upload.admin.labels.gcs.auth_provider_x509_cert_url')),
                        m('input.FormControl', {
                            value: this.values.gcsAuthProviderX509CertUrl() || '',
                            oninput: withAttr('value', this.values.gcsAuthProviderX509CertUrl),
                        }),
                        m('label', app.translator.trans('fof-upload.admin.labels.gcs.client_x509_cert_url')),
                        m('input.FormControl', {
                            value: this.values.gcsClientX509CertUrl() || '',
                            oninput: withAttr('value', this.values.gcsClientX509CertUrl),
                        }),
                    ]),
                    m('fieldset', [
                        m('legend', app.translator.trans('fof-upload.admin.labels.gcs.advanced_title')),
                        m('label', app.translator.trans('fof-upload.admin.labels.gcs.prefix')),
                        m('input.FormControl', {
                            value: this.values.gcsUploadPrefix() || '',
                            oninput: withAttr('value', this.values.gcsUploadPrefix),
                        }),
                    ]),
                ])
            );
        }

        return items;
    }

    getTemplateOptionsForInput() {
        const options = {};

        for (let option in this.templateOptions) {
            if (!this.templateOptions.hasOwnProperty(option)) {
                continue;
            }

            options[option] = this.templateOptions[option].name;
        }

        return options;
    }

    updateMimeTypeKey(mime, value) {
        this.values.mimeTypes()[value] = this.values.mimeTypes()[mime];

        this.deleteMimeType(mime);
    }

    updateMimeTypeAdapter(mime, config, value) {
        config.adapter = value;
        this.values.mimeTypes()[mime] = config;
    }

    updateMimeTypeTemplate(mime, config, value) {
        config.template = value;
        this.values.mimeTypes()[mime] = config;
    }

    deleteMimeType(mime) {
        delete this.values.mimeTypes()[mime];
    }

    templateOptionsDescriptions() {
        const children = [];

        for (let template in this.templateOptions) {
            if (!this.templateOptions.hasOwnProperty(template)) {
                continue;
            }

            children.push(m('li', this.templateOptions[template].name + ': ' + this.templateOptions[template].description));
        }

        return m('ul', children);
    }

    addMimeType() {
        this.values.mimeTypes()[this.newMimeType.regex()] = {
            adapter: this.newMimeType.adapter(),
            template: this.newMimeType.template(),
        };

        this.newMimeType.regex('');
        this.newMimeType.adapter('local');
        this.newMimeType.template('file');
    }

    /**
     * Checks if the values of the fields and checkboxes are different from
     * the ones stored in the database
     *
     * @returns boolean
     */
    changed() {
        const fieldsCheck = this.fields.some((key) => this.values[key]() !== app.data.settings[this.addPrefix(key)]);
        const checkboxesCheck = this.checkboxes.some((key) => this.values[key]() !== (app.data.settings[this.addPrefix(key)] === '1'));
        const objectsCheck = this.objects.some((key) => JSON.stringify(this.values[key]()) !== app.data.settings[this.addPrefix(key)]);

        return fieldsCheck || checkboxesCheck || objectsCheck;
    }

    /**
     * Saves the settings to the database and redraw the page
     *
     * @param e
     */
    onsubmit(e) {
        // prevent the usual form submit behaviour
        e.preventDefault();

        // if the page is already saving, do nothing
        if (this.loading) return;

        // prevents multiple savings
        this.loading = true;

        // remove previous success popup
        app.alerts.dismiss(this.successAlert);

        const settings = {};

        // gets all the values from the form
        this.fields.forEach((key) => (settings[this.addPrefix(key)] = this.values[key]()));
        this.checkboxes.forEach((key) => (settings[this.addPrefix(key)] = this.values[key]()));
        this.objects.forEach((key) => (settings[this.addPrefix(key)] = JSON.stringify(this.values[key]())));

        // actually saves everything in the database
        saveSettings(settings)
            .then(() => {
                // on success, show popup
                this.successAlert = app.alerts.show(Alert, { type: 'success' }, app.translator.trans('core.admin.basics.saved_message'));
            })
            .catch(() => {})
            .then(() => {
                // return to the initial state and redraw the page
                this.loading = false;
                m.redraw();
            });
    }

    /**
     * Adds the prefix `this.settingsPrefix` at the beginning of `key`
     *
     * @returns string
     */
    addPrefix(key) {
        return this.settingsPrefix + '.' + key;
    }
}

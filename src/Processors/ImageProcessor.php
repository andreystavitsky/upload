<?php

/*
 * This file is part of fof/upload.
 *
 * Copyright (c) 2020 - 2021 FriendsOfFlarum.
 * Copyright (c) 2016 - 2019 Flagrow
 *
 * For the full copyright and license information, please view the LICENSE.md
 * file that was distributed with this source code.
 */

namespace FoF\Upload\Processors;

use Flarum\Foundation\Paths;
use Flarum\Foundation\ValidationException;
use Flarum\Settings\SettingsRepositoryInterface;
use FoF\Upload\Contracts\Processable;
use FoF\Upload\File;
use FoF\Upload\Helpers\Util;
use Intervention\Image\Exception\NotReadableException;
use Intervention\Image\Image;
use Intervention\Image\ImageManager;
use Symfony\Component\HttpFoundation\File\UploadedFile;

class ImageProcessor implements Processable
{
    /**
     * @var SettingsRepositoryInterface
     */
    protected $settings;

    /**
     * @var Paths
     */
    protected $paths;

    /**
     * @param Settings $settings
     * @param Paths    $paths
     */
    public function __construct(SettingsRepositoryInterface $settings, Paths $paths)
    {
        $this->settings = $settings;
        $this->paths = $paths;
    }

    /**
     * @param File         $file
     * @param UploadedFile $upload
     */
    public function process(File $file, UploadedFile $upload, string $mimeType)
    {
        if ($mimeType == 'image/jpeg' || $mimeType == 'image/png' || $mimeType == 'image/webp') {
            try {
                $image = (new ImageManager())->make($upload->getRealPath());
            } catch (NotReadableException $e) {
                throw new ValidationException(['upload' => 'Corrupted image']);
            }

            $encodeFormat = $mimeType;
            $encodeQuality = 90;

            if ($this->settings->get('fof-upload.mustResize')) {
                $this->resize($image);
            }

            if ($this->settings->get('fof-upload.addsWatermarks')) {
                $this->watermark($image);
            }

            if ($this->settings->get('fof-upload.mustEncode')) {
                $encodeFormat = $this->settings->get('fof-upload.encodeImageType');
                $encodeQuality = $this->settings->get('fof-upload.encodeQuality');
            }

            $image->orientate();

            @file_put_contents(
                $upload->getRealPath(),
                $image->encode($encodeFormat, $encodeQuality)
            );
        }
    }

    /**
     * @param Image $manager
     */
    protected function resize(Image $manager)
    {
        $maxSize = $this->settings->get('fof-upload.resizeMaxWidth', Util::DEFAULT_MAX_IMAGE_WIDTH);
        $manager->resize(
            $maxSize,
            $maxSize,
            function ($constraint) {
                $constraint->aspectRatio();
                $constraint->upsize();
            }
        );
    }

    /**
     * @param Image $image
     */
    protected function watermark(Image $image)
    {
        if ($this->settings->get('fof-upload.watermark')) {
            $image->insert(
                $this->paths->storage.DIRECTORY_SEPARATOR.$this->settings->get('fof-upload.watermark'),
                $this->settings->get('fof-upload.watermarkPosition', 'bottom-right')
            );
        }
    }
}

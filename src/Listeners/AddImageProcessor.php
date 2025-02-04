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

namespace FoF\Upload\Listeners;

use FoF\Upload\Events\File\WillBeUploaded;
use FoF\Upload\Processors\ImageProcessor;

class AddImageProcessor
{
    /**
     * @var ImageProcessor
     */
    public $processor;

    public function __construct(ImageProcessor $processor)
    {
        $this->processor = $processor;
    }

    public function handle(WillBeUploaded $event)
    {
        if ($this->validateMime($event->mime)) {
            $this->processor->process($event->file, $event->uploadedFile, $event->mime);
        }
    }

    protected function validateMime($mime): bool
    {
        if ($mime == 'image/jpeg' || $mime == 'image/png' || $mime == 'image/webp' || $mime == 'image/gif' || $mime == 'image/svg+xml') {
            return true;
        }

        return false;
    }
}

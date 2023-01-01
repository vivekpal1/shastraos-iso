/* -*- Mode: js; indent-tabs-mode: nil; js-basic-offset: 4; tab-width: 4; -*- */
/*
 * This file is part of Wifi QrCode.
 * https://gitlab.gnome.org/glerro/gnome-shell-extension-wifiqrcode
 *
 * extension.js
 *
 * Copyright (c) 2021-2022 Gianni Lerro {glerro} ~ <glerro@pm.me>
 *
 * Wifi QrCode is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by the
 * Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Wifi QrCode is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License along
 * with Wifi QrCode. If not, see <http://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 * SPDX-FileCopyrightText: 2021-2022 Gianni Lerro <glerro@pm.me>
 */

/* exported init */

'use strict';

// const Gettext = imports.gettext;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const ExtensionName = Me.metadata.name;
const ExtensionVersion = Me.metadata.version;

const Config = imports.misc.config;
const SHELL_MAJOR = parseInt(Config.PACKAGE_VERSION.split('.')[0]);

const WifiQrCode = SHELL_MAJOR < 43 ? Me.imports.WifiQrCode_legacy : Me.imports.WifiQrCode;

class Extension {
    constructor() {
        this._wifiqrcode = null;
    }

    enable() {
        log(`Enabling ${ExtensionName} - Version ${ExtensionVersion}`);

        this._wifiqrcode = new WifiQrCode.WifiQrCode();
    }

    disable() {
        log(`Disabling ${ExtensionName} - Version ${ExtensionVersion}`);

        if (this._wifiqrcode !== null) {
            this._wifiqrcode.destroy();
            this._wifiqrcode = null;
        }
    }
}

/**
 * This function is called once when extension is loaded, not enabled.
 *
 * @param {ExtensionMeta} meta - An extension meta object.
 * @returns {Extension} - the extension object with enable() and disable() methods.
 */
function init(meta) {
    log(`Inizializing ${meta.metadata.name} - Version ${meta.metadata.version}`);

    // Inizializing translations
    // ExtensionUtils.initTranslations();

    return new Extension();
}


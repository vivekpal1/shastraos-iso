/* -*- Mode: js; indent-tabs-mode: nil; js-basic-offset: 4; tab-width: 4; -*- */
/*
 * This file is part of Wifi QrCode.
 * https://gitlab.gnome.org/glerro/gnome-shell-extension-wifiqrcode
 *
 * WifiQrCode_legacy.js
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

/* exported WifiQrCode */

'use strict';

// const Gettext = imports.gettext;

const {GLib, NM} = imports.gi;

const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const ExtensionName = Me.metadata.name;

const {SignalManager, QrCode} = Me.imports;


var WifiQrCode = class WifiQrCode {
    constructor() {
        this._nAttempts = 0;
        this._signalManager = new SignalManager.SignalManager();

        // NOTE: Make sure don't initialize anything after this
        this._checkDevices();
    }

    _checkDevices() {
        if (this._timeoutId) {
            GLib.source_remove(this._timeoutId);
            this._timeoutId = null;
        }

        this._network = Main.panel.statusArea.aggregateMenu._network;

        if (this._network) {
            if (!this._network._client) {
                // Shell not initialized completely wait for max of 100 * 1s
                log(`${ExtensionName}: Gnome Shell is not inizialized`);
                if (this._nAttempts++  < 100) {
                    this._timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT,
                        1000, this._checkDevices.bind(this));
                }
            } else {
                this._client = this._network._client;

                for (let device of this._network._nmDevices)
                    this._deviceAdded(this._client, device);

                this._signalManager.addSignal(this._client, 'device-added', this._deviceAdded.bind(this));
                this._signalManager.addSignal(this._client, 'device-removed', this._deviceRemoved.bind(this));
            }
        }
    }

    _deviceAdded(client, device) {
        if ((device.get_device_type() !== NM.DeviceType.WIFI) ||
            (device.get_state() === NM.DeviceState.UNMANAGED))
            return;

        log(`${ExtensionName}: Device Added: ${device.product}`);

        this._signalManager.addSignal(device, 'state-changed', this._stateChanged.bind(this));

        this._addMenu(device);
    }

    _addMenu(device, _delegate) {
        if (device) {
            log(`${ExtensionName}: Adding menu....`);

            if (!device._delegate) {
                // Device delegate not created wait for max of 1s
                log(`${ExtensionName}: Device delegate not ready, waiting...`);
                if (!device.timeout) {
                    device.timeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000,  () => {
                        this._addMenu(device);
                    });
                    return;
                } else {
                    return;
                }
            }

            if (device.timeout) {
                GLib.source_remove(device.timeout);
                device.timeout = null;
            }

            if (device.get_state() !== NM.DeviceState.ACTIVATED)
                return;

            let wrapper = device._delegate;

            if (!wrapper.QrCodeMenuSection) {
                wrapper.QrCodeMenuSection = new PopupMenu.PopupMenuSection();
                wrapper.switchMenuItem = new PopupMenu.PopupSwitchMenuItem('Show QrCode', false);

                wrapper.QrCodeBox = new QrCode.QrCodeBox(device, false);

                wrapper.QrCodeMenuSection.actor.add(wrapper.switchMenuItem);
                wrapper.QrCodeMenuSection.actor.add(wrapper.QrCodeBox);

                // Add a timer to automatically close the switch menu for privacy
                wrapper.switchMenuItem.connect('toggled', () => {
                    wrapper.QrCodeBox.visible = wrapper.switchMenuItem.state;
                    if (device.privacyTimeout) {
                        GLib.source_remove(device.privacyTimeout);
                        device.privacyTimeout = null;
                    } else if (wrapper.switchMenuItem.state) {
                        // TODO: Eventually create a setting to regulate the time.
                        device.privacyTimeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 10000,  () => {
                            wrapper.switchMenuItem.toggle();
                            return GLib.SOURCE_REMOVE;
                        });
                    }
                });

                wrapper.item.menu.addMenuItem(wrapper.QrCodeMenuSection);
            }

            this._stateChanged(device, device.state, device.state, null);
        }
    }

    _deviceRemoved(client, device) {
        if ((device.get_device_type() !== NM.DeviceType.WIFI) ||
            (device.get_state() === NM.DeviceState.UNMANAGED))
            return;

        log(`${ExtensionName}: Device Removed: ${device.product}`);

        this._signalManager.disconnectBySource(device);

        this._removeMenu(device);
    }

    _removeMenu(device) {
        log(`${ExtensionName}: Removing menu....`);

        if (!device._delegate)
            return;

        let wrapper = device._delegate;

        if (wrapper.QrCodeMenuSection) {
            wrapper.QrCodeMenuSection.destroy();
            wrapper.QrCodeMenuSection = null;
        }
    }

    _stateChanged(device, newstate, _oldstate, _reason) {
        if (device.get_device_type() !== NM.DeviceType.WIFI)
            return;

        log(`${ExtensionName}: Device State Changed: ${device.product}`);

        if (!device._delegate)
            return;

        let wrapper = device._delegate;

        if (wrapper.QrCodeMenuSection && newstate !== NM.DeviceState.ACTIVATED)
            this._removeMenu(device);

        if (!wrapper.QrCodeMenuSection && newstate === NM.DeviceState.ACTIVATED)
            this._addMenu(device);
    }

    destroy() {
        log(`${ExtensionName}: Destroying....bye bye`);

        if (this._network && this._network._nmDevices) {
            for (let device of this._network._nmDevices) {
                this._deviceRemoved(device);
                if (device.timeout) {
                    GLib.source_remove(device.timeout);
                    device.timeout = null;
                }
                if (device.privacyTimeout) {
                    GLib.source_remove(device.privacyTimeout);
                    device.privacyTimeout = null;
                }
            }
        }

        if (this._timeoutId) {
            GLib.source_remove(this._timeoutId);
            this._timeoutId = null;
        }

        this._signalManager.disconnectAll();
    }
};


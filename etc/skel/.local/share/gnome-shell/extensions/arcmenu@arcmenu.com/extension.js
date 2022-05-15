/*
 * ArcMenu - Application Menu Extension for GNOME
 * Andrew Zaech https://gitlab.com/AndrewZaech
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const {GLib, Gio, St} = imports.gi;
const Constants = Me.imports.constants;
const Controller = Me.imports.controller;
const Config = imports.misc.config;
const ShellVersion = parseFloat(Config.PACKAGE_VERSION);

const Main = imports.ui.main;
const Util = imports.misc.util;
const Utils = Me.imports.utils;

// Initialize panel button variables
let settings;
let settingsControllers;
let extensionChangedId;

// Initialize menu language translations
function init() {
    ExtensionUtils.initTranslations(Me.metadata['gettext-domain']);
}

// Enable the extension
function enable() {
    if(imports.gi.Meta.is_wayland_compositor())
        Me.metadata.isWayland = true;
    else
        Me.metadata.isWayland = false;

    settings = ExtensionUtils.getSettings(Me.metadata['settings-schema']);
    settings.connect('changed::multi-monitor', () => _reload());
    settings.connect('changed::dash-to-panel-standalone', () => _reload());
    settingsControllers = [];

    Me.customStylesheet = Utils.getStylesheetFile();
    Utils.updateStylesheet(settings);

    _enableButtons();

    // dash to panel might get enabled after Arc-Menu
    extensionChangedId = Main.extensionManager.connect('extension-state-changed', (data, extension) => {
        if (extension.uuid === 'dash-to-panel@jderose9.github.com') {
            _disconnectDtpSignals();
            _connectDtpSignals();
            _reload();
        }
    });

    // listen to dash to panel if they are compatible and already enabled
    _connectDtpSignals();
}

function disable() {
    if(extensionChangedId){
        Main.extensionManager.disconnect(extensionChangedId);
        extensionChangedId = null;
    }

    Utils.unloadStylesheet();
    delete Me.customStylesheet;

    _disconnectDtpSignals();

    _disableButtons();
    settingsControllers = null;

    settings.run_dispose();
    settings = null;
}


function _connectDtpSignals() {
    if(global.dashToPanel)
        global.dashToPanel._amPanelsCreatedId = global.dashToPanel.connect('panels-created', () => _reload());
}

function _disconnectDtpSignals() {
    if(global.dashToPanel?._amPanelsCreatedId){
        global.dashToPanel.disconnect(global.dashToPanel._amPanelsCreatedId);
        delete global.dashToPanel._amPanelsCreatedId;
    }
}

function _reload() {
    _disableButtons();
    _enableButtons();
}

function _enableButtons() {
    let multiMonitor = settings.get_boolean('multi-monitor');

    let dashToPanelEnabled = false;
    let panelArray = [Main.panel];
    if(global.dashToPanel && global.dashToPanel.panels){
        panelArray = global.dashToPanel.panels.map(pw => pw);
        dashToPanelEnabled = true;
    }

    let panelLength = multiMonitor ? panelArray.length : 1;
    for(var index = 0; index < panelLength; index++){
        let panel = dashToPanelEnabled ? panelArray[index].panel : panelArray[index];
        let panelParent = panelArray[index];

        //Place ArcMenu in top panel when Dash to Panel setting "Keep original gnome-shell top panel" is on
        let isStandalone = settings.get_boolean('dash-to-panel-standalone') && dashToPanelEnabled;
        if(isStandalone && ('isPrimary' in panelParent && panelParent.isPrimary) && panelParent.isStandalone)
            panel = Main.panel;
    
        let isPrimaryPanel = index === 0 ? true : false;
        let settingsController = new Controller.MenuSettingsController(settings, settingsControllers, panel, isPrimaryPanel);

        settingsController.monitorIndex = panelParent.monitor?.index ?? 0;

        if(dashToPanelEnabled)
            panel._amDestroyId = panel.connect('destroy', () => extensionChangedId ? _disableButton(settingsController) : null);

        settingsController.enableButton();
        settingsController.bindSettingsChanges();
        settingsControllers.push(settingsController);
    }
}

function _disableButtons(){
    for (let i = settingsControllers.length - 1; i >= 0; --i) {
        let sc = settingsControllers[i];
        _disableButton(sc);
    }
}

function _disableButton(controller) {
    if(controller.panel?._amDestroyId){
        controller.panel.disconnect(controller.panel._amDestroyId);
        delete controller.panel._amDestroyId;
    }

    settingsControllers.splice(settingsControllers.indexOf(controller), 1);
    controller.destroy();
}

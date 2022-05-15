const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const {Adw, Gdk, GdkPixbuf, Gio, GLib, GObject, Gtk} = imports.gi;
const ByteArray = imports.byteArray;
const Constants = Me.imports.constants;
const Gettext = imports.gettext.domain(Me.metadata['gettext-domain']);
const LayoutTweaks = Me.imports.menulayouts.tweaks;
const PW = Me.imports.prefsWidgets;
const Utils = Me.imports.utils;
const _ = Gettext.gettext;

const SCHEMA_PATH = '/org/gnome/shell/extensions/arcmenu/';
const GSET = 'gnome-shell-extension-tool';

var MenuSettingsListPage = GObject.registerClass(
    class ArcMenu_MenuSettingsListPage extends Gtk.Box {
        _init(settings, listType, settingString) {
            super._init({
                margin_top: 10,
                margin_bottom: 10,
                margin_start: 5,
                margin_end: 5,
                spacing: 20,
                orientation: Gtk.Orientation.VERTICAL
            });
            this.listType = listType;
            this._settings = settings;

            let addMoreTitle;
            if(this.listType === Constants.MenuSettingsListType.PINNED_APPS){
                this.settingString = 'pinned-app-list';
                this.appsList = this._settings.get_strv('pinned-app-list');
                addMoreTitle = _("Add More Apps");
            }
            else if(this.listType === Constants.MenuSettingsListType.DIRECTORIES){
                this.settingString = 'directory-shortcuts-list';
                this.appsList = [];
                let appsList = this._settings.get_value('directory-shortcuts-list').deep_unpack();
                for(let i = 0; i < appsList.length; i++){
                    this.appsList.push(appsList[i][0]);
                    this.appsList.push(appsList[i][1]);
                    this.appsList.push(appsList[i][2]);
                }
                addMoreTitle = _("Add Default User Directories");
            }
            else if(this.listType === Constants.MenuSettingsListType.APPLICATIONS){
                this.settingString = 'application-shortcuts-list';
                this.appsList = [];
                let appsList = this._settings.get_value('application-shortcuts-list').deep_unpack();
                for(let i = 0; i < appsList.length; i++){
                    this.appsList.push(appsList[i][0]);
                    this.appsList.push(appsList[i][1]);
                    this.appsList.push(appsList[i][2]);
                }
                addMoreTitle = _("Add More Apps");
            }
            else if(this.listType === Constants.MenuSettingsListType.OTHER){
                this.settingString = settingString;
                this.appsList = this._settings.get_strv(settingString);
            }

            this.frameRows = [];
            this.frame = new Adw.PreferencesGroup();

            this._createFrame(this.appsList);
            this.append(this.frame);

            if(this.listType !== Constants.MenuSettingsListType.OTHER){
                let addMoreGroup = new Adw.PreferencesGroup();
                let addMoreButton = new PW.Button({
                    icon_name: 'list-add-symbolic',
                });
                addMoreButton.connect('clicked', ()=> {
                    let dialog = new AddAppsToPinnedListWindow(this._settings, this, this.listType, this.settingString);
                    dialog.show();
                    dialog.connect('response', (_w, response) => {
                        if(response === Gtk.ResponseType.APPLY) {
                            this._createFrame(dialog.newPinnedAppArray);
                            this.saveSettings();
                        }
                        if(response === Gtk.ResponseType.REJECT) {
                            let command = dialog.newPinnedAppArray[2];
                            let frameRow;
                            this.frameRows.forEach(child => {
                                if(command === child._cmd)
                                    frameRow = child;
                            });
                            if(frameRow){
                                this.frameRows.splice(this.frameRows.indexOf(frameRow), 1);
                                this.frame.remove(frameRow);
                                this.saveSettings();
                            }
                        }
                    });
                });
                let addMoreRow = new Adw.ActionRow({
                    title: _(addMoreTitle),
                    activatable_widget: addMoreButton
                });
                addMoreRow.add_suffix(addMoreButton);
                addMoreGroup.add(addMoreRow);
                this.append(addMoreGroup);

                let addCustomButton = new PW.Button({
                    icon_name: 'list-add-symbolic',
                });
                addCustomButton.connect('clicked', ()=> {
                    let dialog = new AddCustomLinkDialogWindow(this._settings, this, this.listType);
                    dialog.show();
                    dialog.connect('response', (_w, response) => {
                        if(response === Gtk.ResponseType.APPLY) {
                            let newPinnedApps = dialog.newPinnedAppArray;
                            this._createFrame(newPinnedApps);
                            dialog.destroy();
                            this.saveSettings();
                        }
                    });
                });
                let addCustomRow = new Adw.ActionRow({
                    title: _("Add Custom Shortcut"),
                    activatable_widget: addCustomButton
                });
                addCustomRow.add_suffix(addCustomButton);
                addMoreGroup.add(addCustomRow);
            }

            this.restoreDefaults = () => {
                this.frameRows.forEach(child => {
                    this.frame.remove(child);
                });

                this.frameRows = [];

                let appsList = this._settings.get_default_value(this.settingString).deep_unpack();
                if(this.listType !== Constants.MenuSettingsListType.PINNED_APPS){
                    this.appsList = [];
                    for(let i = 0; i < appsList.length; i++){
                        this.appsList.push(appsList[i][0]);
                        this.appsList.push(appsList[i][1]);
                        this.appsList.push(appsList[i][2]);
                    }
                }
                else
                    this.appsList = appsList;

                this._createFrame(this.appsList);
                this.saveSettings();
            };
        }

        saveSettings(){
            let array = [];
            this.frameRows.sort((a, b) => {
                return a.get_index() > b.get_index();
            })
            this.frameRows.forEach(child => {
                if(this.listType === Constants.MenuSettingsListType.PINNED_APPS || this.listType === Constants.MenuSettingsListType.OTHER){
                    array.push(child._name);
                    array.push(child._icon);
                    array.push(child._cmd);
                }
                else
                    array.push([child._name, child._icon, child._cmd]);
            });

            if(this.listType === Constants.MenuSettingsListType.PINNED_APPS || this.listType === Constants.MenuSettingsListType.OTHER)
                this._settings.set_strv(this.settingString, array);
            else
                this._settings.set_value(this.settingString, new GLib.Variant('aas', array));
        }

        _createFrame(array) {
            for(let i = 0; i < array.length; i += 3) {
                let frameRow = new PW.DragRow();
                let editable = true;
                if(array[i + 2].startsWith("ArcMenu_")){
                    editable = false;
                }

                let iconString;
                frameRow._name = array[i];
                frameRow._icon = array[i + 1];
                frameRow._cmd = array[i + 2];

                if(frameRow._icon === "ArcMenu_ArcMenuIcon"){
                    frameRow._icon = Me.path + '/media/icons/menu_icons/arc-menu-symbolic.svg';
                }
                else if(frameRow._cmd === 'ArcMenu_Software'){
                    for(let softwareManagerID of Constants.SoftwareManagerIDs){
                        let app = Gio.DesktopAppInfo.new(softwareManagerID);
                        if(app){
                            frameRow._icon = app.get_icon()?.to_string();
                            break;
                        }
                    }
                }
                else if(this.listType === Constants.MenuSettingsListType.DIRECTORIES || this.listType === Constants.MenuSettingsListType.OTHER){
                    frameRow._icon = getIconPath([array[i], array[i + 1], array[i + 2]]);
                }

                iconString = frameRow._icon;
                if((iconString === "" || iconString === undefined) && Gio.DesktopAppInfo.new(frameRow._cmd)){
                    iconString = Gio.DesktopAppInfo.new(frameRow._cmd).get_icon() ? Gio.DesktopAppInfo.new(frameRow._cmd).get_icon().to_string() : "";
                }
                //frameRow._gicon used in PW.DragRow
                frameRow._gicon = Gio.icon_new_for_string(iconString ? iconString : "");
                let arcMenuImage = new Gtk.Image( {
                    gicon: frameRow._gicon,
                    pixel_size: 22
                });
                let dragImage = new Gtk.Image( {
                    gicon: Gio.icon_new_for_string("drag-symbolic"),
                    pixel_size: 12
                });
                frameRow.add_prefix(arcMenuImage);
                frameRow.add_prefix(dragImage);
                frameRow.title = _(frameRow._name);

                checkIfValidShortcut(frameRow, arcMenuImage);

                let buttonBox;
                if(this.listType === Constants.MenuSettingsListType.OTHER){
                    frameRow.hasEditButton = true;
                    buttonBox = new PW.EditEntriesBox({
                        frameRow: frameRow,
                        modifyButton: true,
                        changeButton: true
                    });
                    frameRow.activatable_widget = buttonBox.changeAppButton;
                }
                else{
                    buttonBox = new PW.EditEntriesBox({
                        frameRow: frameRow,
                        modifyButton: editable,
                        deleteButton: true
                    });
                    frameRow.activatable_widget = buttonBox.editButton;
                }

                buttonBox.connect('modify', ()=> {
                    let pinnedShortcut = [frameRow._name, frameRow._icon, frameRow._cmd];
                    let dialog = new AddCustomLinkDialogWindow(this._settings, this, Constants.MenuSettingsListType.PINNED_APPS, pinnedShortcut);
                    dialog.show();
                    dialog.connect('response', (_w, response) => {
                        if(response === Gtk.ResponseType.APPLY) {
                            let newPinnedApps = dialog.newPinnedAppArray;
                            frameRow._name = newPinnedApps[0];
                            frameRow._icon = newPinnedApps[1];
                            frameRow._cmd = newPinnedApps[2];
                            frameRow.title = _(frameRow._name);
                            if(frameRow._icon === "" && Gio.DesktopAppInfo.new(frameRow._cmd))
                                arcMenuImage.gicon = Gio.DesktopAppInfo.new(frameRow._cmd).get_icon();
                            else
                                arcMenuImage.gicon = Gio.icon_new_for_string(frameRow._icon);
                            dialog.destroy();
                            this.saveSettings();
                        }
                    });
                });
                buttonBox.connect('change', ()=> {
                    let dialog = new AddAppsToPinnedListWindow(this._settings, this, Constants.MenuSettingsListType.OTHER, this.settingString);
                    dialog.show();
                    dialog.connect('response', (_w, response) => {
                        if(response === Gtk.ResponseType.APPLY) {
                            let newPinnedApps = dialog.newPinnedAppArray;
                            frameRow._name = newPinnedApps[0];
                            frameRow._icon = newPinnedApps[1];
                            frameRow._cmd = newPinnedApps[2];
                            frameRow.title = _(frameRow._name);
                            let iconString;
                            if(frameRow._icon === "" && Gio.DesktopAppInfo.new(frameRow._cmd)){
                                iconString = Gio.DesktopAppInfo.new(frameRow._cmd).get_icon() ? Gio.DesktopAppInfo.new(frameRow._cmd).get_icon().to_string() : "";
                            }
                            let icon = getIconPath(newPinnedApps);
                            arcMenuImage.gicon = Gio.icon_new_for_string(iconString ? iconString : icon);
                            dialog.destroy();
                            this.saveSettings();
                        }
                    });
                });
                buttonBox.connect("row-changed", () =>{
                    this.saveSettings();
                });
                buttonBox.connect("row-deleted", () =>{
                    this.frameRows.splice(this.frameRows.indexOf(frameRow), 1);
                    this.saveSettings();
                });
                frameRow.connect("drag-drop-done", () => {
                    this.saveSettings();
                });
                frameRow.add_suffix(buttonBox);
                this.frameRows.push(frameRow);
                this.frame.add(frameRow);
            }
        }
});

var AddAppsToPinnedListWindow = GObject.registerClass(
class ArcMenu_AddAppsToPinnedListWindow extends PW.DialogWindow {
    _init(settings, parent, dialogType, settingString) {
        this._settings = settings;
        this._dialogType = dialogType;
        this.settingString = settingString;

        if(this._dialogType === Constants.MenuSettingsListType.PINNED_APPS)
            super._init(_('Add to your Pinned Apps'), parent);
        else if(this._dialogType === Constants.MenuSettingsListType.OTHER)
            super._init(_('Change Selected Pinned App'), parent);
        else if(this._dialogType === Constants.MenuSettingsListType.APPLICATIONS)
            super._init(_('Select Application Shortcuts'), parent);
        else if(this._dialogType === Constants.MenuSettingsListType.DIRECTORIES)
            super._init(_('Select Directory Shortcuts'), parent);
        this.newPinnedAppArray = [];
        this._createPinnedAppsList();

        if(this._dialogType == Constants.MenuSettingsListType.PINNED_APPS){
            let extraItem = [[_("ArcMenu Settings"), Me.path + '/media/icons/menu_icons/arc-menu-symbolic.svg', Constants.ArcMenuSettingsCommand]];
            this._loadExtraCategories(extraItem);
            this._loadCategories();
        }
        else if(this._dialogType == Constants.MenuSettingsListType.DIRECTORIES){
            let extraLinks = this._settings.get_default_value('directory-shortcuts-list').deep_unpack();
            extraLinks.push([_("Computer"), "ArcMenu_Computer", "ArcMenu_Computer"]);
            extraLinks.push([_("Network"), "ArcMenu_Network", "ArcMenu_Network"]);
            extraLinks.push([_("Recent"), "document-open-recent-symbolic", "ArcMenu_Recent"]);
            this._loadExtraCategories(extraLinks);
        }
        else if(this._dialogType == Constants.MenuSettingsListType.APPLICATIONS){
            let extraLinks = [];
            extraLinks.push([_("Activities Overview"), "view-fullscreen-symbolic", "ArcMenu_ActivitiesOverview"]);
            extraLinks.push([_("ArcMenu Settings"), Me.path + '/media/icons/menu_icons/arc-menu-symbolic.svg', Constants.ArcMenuSettingsCommand]);
            extraLinks.push([_("Run Command..."), "system-run-symbolic", "ArcMenu_RunCommand"]);
            extraLinks.push([_("Show All Applications"), "view-fullscreen-symbolic", "ArcMenu_ShowAllApplications"]);
            this._loadExtraCategories(extraLinks);
            this._loadCategories();
        }
        else{
            let extraLinks = this._settings.get_default_value('directory-shortcuts-list').deep_unpack();
            extraLinks.push([_("Computer"), "ArcMenu_Computer", "ArcMenu_Computer"]);
            extraLinks.push([_("Network"), "ArcMenu_Network", "ArcMenu_Network"]);
            extraLinks.push([_("Lock"), "changes-prevent-symbolic", "ArcMenu_Lock"]);
            extraLinks.push([_("Log Out"), "system-log-out-symbolic", "ArcMenu_LogOut"]);
            extraLinks.push([_("Power Off"), "system-shutdown-symbolic", "ArcMenu_PowerOff"]);
            extraLinks.push([_("Restart"), 'system-reboot-symbolic', "ArcMenu_Restart"]);
            extraLinks.push([_("Suspend"), "media-playback-pause-symbolic", "ArcMenu_Suspend"]);
            extraLinks.push([_("Hybrid Sleep"), 'weather-clear-night-symbolic', "ArcMenu_HybridSleep"]);
            extraLinks.push([_("Hibernate"), "document-save-symbolic", "ArcMenu_Hibernate"]);
            this._loadExtraCategories(extraLinks);
            this._loadCategories();
        }
    }

    _createPinnedAppsList(){
        let appsList = this._settings.get_value(this.settingString).deep_unpack();
        if(this._dialogType !== Constants.MenuSettingsListType.PINNED_APPS){
            this.appsList = [];
            for(let i = 0; i < appsList.length; i++){
                this.appsList.push(appsList[i][0]);
                this.appsList.push(appsList[i][1]);
                this.appsList.push(appsList[i][2]);
            }
        }
        else
            this.appsList = appsList;
    }

    findCommandMatch(command){
        for(let i = 2; i < this.appsList.length; i += 3){
            if(this.appsList[i] === command)
                return true;
        }
        return false;
    }

    _loadExtraCategories(extraCategories){
        for(let item of extraCategories){
            let frameRow = new Adw.ActionRow({
                title: _(item[0])
            });

            let iconString;
            if(this._dialogType === Constants.MenuSettingsListType.DIRECTORIES || this._dialogType === Constants.MenuSettingsListType.OTHER)
                iconString = getIconPath([item[0], item[1], item[2]]);
            else
                iconString = item[1];

            frameRow._name = _(item[0]);
            frameRow._icon = item[1];
            frameRow._cmd = item[2];

            let iconImage = new Gtk.Image( {
                gicon: Gio.icon_new_for_string(iconString),
                pixel_size: 22
            });
            frameRow.add_prefix(iconImage);
            let match = this.findCommandMatch(frameRow._cmd);

            this.addButtonAction(frameRow, match);
            this.pageGroup.add(frameRow);
        }
    }

    _loadCategories() {
        let allApps = Gio.app_info_get_all();
        allApps.sort((a, b) => {
            let _a = a.get_display_name();
            let _b = b.get_display_name();
            return GLib.strcmp0(_a, _b);
        });

        for(let i = 0; i < allApps.length; i++) {
            if(allApps[i].should_show()) {
                let frameRow = new Adw.ActionRow();
                frameRow._app = allApps[i];
                frameRow._name = allApps[i].get_display_name();
                frameRow._icon = '';
                frameRow._cmd = allApps[i].get_id();
                frameRow.title = frameRow._name;

                let icon = allApps[i].get_icon() ? allApps[i].get_icon().to_string() : "dialog-information";

                let iconImage = new Gtk.Image( {
                    gicon: Gio.icon_new_for_string(icon),
                    pixel_size: 22
                });
                frameRow.add_prefix(iconImage);

                let match = this.findCommandMatch(allApps[i].get_id());

                this.addButtonAction(frameRow, match);
                this.pageGroup.add(frameRow);
            }
        }
    }

    addButtonAction(frameRow, match){
        if(this._dialogType == Constants.MenuSettingsListType.PINNED_APPS || this._dialogType == Constants.MenuSettingsListType.APPLICATIONS||
            this._dialogType == Constants.MenuSettingsListType.DIRECTORIES){
            let checkButton = new PW.Button({
                icon_name: match ? 'list-remove-symbolic' : 'list-add-symbolic',
                margin_end: 20
            });
            checkButton.connect('clicked', (widget) => {
                this.newPinnedAppArray = [frameRow._name, frameRow._icon, frameRow._cmd];

                if(!match){
                    this.currentToast?.dismiss();

                    this.currentToast = new Adw.Toast({
                        title: _("%s has been pinned to ArcMenu").format(frameRow._name),
                        timeout: 2
                    });
                    this.currentToast.connect("dismissed", () => this.currentToast = null);

                    this.add_toast(this.currentToast);
                    this.emit("response", Gtk.ResponseType.APPLY);
                }
                else{
                    this.currentToast?.dismiss();

                    this.currentToast = new Adw.Toast({
                        title: _("%s has been unpinned from ArcMenu").format(frameRow._name),
                        timeout: 2
                    });
                    this.currentToast.connect("dismissed", () => this.currentToast = null);

                    this.add_toast(this.currentToast);
                    this.emit("response", Gtk.ResponseType.REJECT);
                }

                match = !match;
                checkButton.icon_name = match ? 'list-remove-symbolic' : 'list-add-symbolic';
            });
            frameRow.add_suffix(checkButton);
            frameRow.activatable_widget = checkButton;
        }
        else{
            let checkButton = new PW.Button({
                icon_name: 'list-add-symbolic',
                margin_end: 20
            });
            checkButton.connect('clicked', () => {
                this.newPinnedAppArray = [frameRow._name, frameRow._icon, frameRow._cmd];
                this.emit("response", Gtk.ResponseType.APPLY);
            });
            frameRow.add_suffix(checkButton);
            frameRow.activatable_widget = checkButton;
        }
    }
});

var AddCustomLinkDialogWindow = GObject.registerClass(
    class ArcMenu_AddCustomLinkDialogWindow extends PW.DialogWindow {
        _init(settings, parent, dialogType, pinnedShortcut = null) {
            let title = _('Add a Custom Shortcut');
            let isPinnedApps = this._dialogType === Constants.MenuSettingsListType.PINNED_APPS || this._dialogType === Constants.MenuSettingsListType.OTHER;
            if (pinnedShortcut && isPinnedApps)
                title = _('Edit Pinned App');
            else if (pinnedShortcut)
                title = _('Edit Shortcut');

            super._init(_(title), parent, Constants.MenuItemLocation.BOTTOM);
            this.set_default_size(550, 220);
            this._settings = settings;
            this.newPinnedAppArray = [];
            this._dialogType = dialogType;
            this.pinnedShortcut = pinnedShortcut;

            let nameFrameRow = new Adw.ActionRow({
                title: _('Title')
            });

            let nameEntry = new Gtk.Entry({
                valign: Gtk.Align.CENTER,
                width_chars: 35
            });
            nameFrameRow.add_suffix(nameEntry);
            this.pageGroup.add(nameFrameRow);

            let iconFrameRow = new Adw.ActionRow({
                title: _('Icon')
            });
            let iconEntry = new Gtk.Entry({
                valign: Gtk.Align.CENTER,
                width_chars: 35
            });

            let fileFilter = new Gtk.FileFilter();
            fileFilter.add_pixbuf_formats();
            let fileChooserButton = new Gtk.Button({
                label: _('Browse...'),
                valign: Gtk.Align.CENTER,
            });

            fileChooserButton.connect('clicked', (widget) => {
                let dialog = new Gtk.FileChooserDialog({
                    title: _('Select an Icon'),
                    transient_for: this.get_root(),
                    modal: true,
                    action: Gtk.FileChooserAction.OPEN,
                });
                dialog.add_button("_Cancel", Gtk.ResponseType.CANCEL);
                dialog.add_button("_Open", Gtk.ResponseType.ACCEPT);

                dialog.set_filter(fileFilter);

                dialog.connect("response", (self, response) => {
                    if(response === Gtk.ResponseType.ACCEPT){
                        let iconFilepath = dialog.get_file().get_path();
                        iconEntry.set_text(iconFilepath);
                        dialog.destroy();
                    }
                    else if(response === Gtk.ResponseType.CANCEL)
                        dialog.destroy();
                });
                dialog.show();
            });
            iconFrameRow.add_suffix(iconEntry);
            iconFrameRow.add_suffix(fileChooserButton);
            this.pageGroup.add(iconFrameRow);

            if(this._dialogType === Constants.MenuSettingsListType.DIRECTORIES)
                iconEntry.set_text("ArcMenu_Folder");

            let cmdFrameRow = new Adw.ActionRow({
                title: _('Command')
            });
            if(this._dialogType === Constants.MenuSettingsListType.DIRECTORIES)
                cmdFrameRow.title = _("Shortcut Path");

            let cmdEntry = new Gtk.Entry({
                valign: Gtk.Align.CENTER,
                width_chars: 35
            });
            cmdFrameRow.add_suffix(cmdEntry);
            this.pageGroup.add(cmdFrameRow);

            let addButton = new Gtk.Button({
                label: this.pinnedShortcut ?_("Apply") :_("Add"),
                halign: Gtk.Align.END
            });
            let context = addButton.get_style_context();
            context.add_class('suggested-action');
            if(this.pinnedShortcut !== null) {
                nameEntry.text = this.pinnedShortcut[0];
                iconEntry.text = this.pinnedShortcut[1];
                cmdEntry.text = this.pinnedShortcut[2];
            }
            addButton.connect('clicked', ()=> {
                this.newPinnedAppArray.push(nameEntry.get_text());
                this.newPinnedAppArray.push(iconEntry.get_text());
                this.newPinnedAppArray.push(cmdEntry.get_text());
                this.emit('response', Gtk.ResponseType.APPLY);
            });

            this.headerGroup.add(addButton);
        }
});

var GeneralPage = GObject.registerClass(
    class ArcMenu_GeneralPage extends Adw.PreferencesPage {
        _init(settings) {
            super._init({
                title: _('General'),
                icon_name: 'go-home-symbolic',
                name: 'GeneralSettingPage'
            });
            this._settings = settings;

            let menuDisplayGroup = new Adw.PreferencesGroup({
                title: _("Display Options")
            });
            this.add(menuDisplayGroup);

            //Show Activities Row----------------------------------------------------------------------------
            let showActivitiesSwitch = new Gtk.Switch({
                valign: Gtk.Align.CENTER,
                active: this._settings.get_boolean('show-activities-button')
            });
            showActivitiesSwitch.connect('notify::active', (widget) => {
                this._settings.set_boolean('show-activities-button', widget.get_active());
            });
            let showActivitiesRow = new Adw.ActionRow({
                title: _("Show Activities Button"),
                activatable_widget: showActivitiesSwitch
            });
            showActivitiesRow.add_suffix(showActivitiesSwitch);
            //-----------------------------------------------------------------------------------------------

            //Position in Panel Row-------------------------------------------------------------
            let menuPositions = new Gtk.StringList();
            menuPositions.append(_('Left'));
            menuPositions.append(_('Center'));
            menuPositions.append(_('Right'));
            let menuPositionRow = new Adw.ComboRow({
                title: _("Position in Panel"),
                model: menuPositions,
                selected: this._settings.get_enum('position-in-panel')
            });
            menuPositionRow.connect("notify::selected", (widget) => {
                if(widget.selected === Constants.MenuPosition.CENTER)
                    menuAlignmentRow.show();
                else
                    menuAlignmentRow.hide();
                this._settings.set_enum('position-in-panel', widget.selected);
            });
            //--------------------------------------------------------------------------------------

            //Menu Alignment row--------------------------------------------------------------------
            let menuAlignmentScale = new Gtk.Scale({
                valign: Gtk.Align.CENTER,
                orientation: Gtk.Orientation.HORIZONTAL,
                adjustment: new Gtk.Adjustment({ lower: 0, upper: 100, step_increment: 1, page_increment: 1, page_size: 0 }),
                digits: 0, round_digits: 0, hexpand: true,

            });
            menuAlignmentScale.set_value(this._settings.get_int('menu-position-alignment'));
            menuAlignmentScale.add_mark(0, Gtk.PositionType.BOTTOM, _("Left"));
            menuAlignmentScale.add_mark(50, Gtk.PositionType.BOTTOM, _("Center"));
            menuAlignmentScale.add_mark(100, Gtk.PositionType.BOTTOM, _("Right"));

            menuAlignmentScale.connect('value-changed', (widget) => {
                this._settings.set_int('menu-position-alignment', widget.get_value());
            });
            let menuAlignmentRow = new Adw.ActionRow({
                title: _("Menu Alignment"),
                activatable_widget: menuAlignmentScale,
                visible: this._settings.get_enum('position-in-panel') === Constants.MenuPosition.CENTER
            });
            menuAlignmentRow.add_suffix(menuAlignmentScale);
            //-------------------------------------------------------------------------------------

            //Mulit Monitor Row -------------------------------------------------------------------
            let multiMonitorSwitch = new Gtk.Switch({
                valign: Gtk.Align.CENTER,
                active: this._settings.get_boolean('multi-monitor')
            });
            multiMonitorSwitch.connect('notify::active', (widget) => {
                this._settings.set_boolean('multi-monitor', widget.get_active());
                menuHotkeyGroup.displayRows();
                runnerHotkeyGroup.displayRows();
            });

            let multiMonitorRow = new Adw.ActionRow({
                title: _("Display ArcMenu on all Panels"),
                subtitle: _("Dash to Panel extension required"),
                activatable_widget: multiMonitorSwitch
            });
            multiMonitorRow.add_suffix(multiMonitorSwitch);
            //--------------------------------------------------------------------------------------

            //Prefer Top Panel -------------------------------------------------------------------
            let preferTopPanelSwitch = new Gtk.Switch({
                valign: Gtk.Align.CENTER,
                active: this._settings.get_boolean('dash-to-panel-standalone')
            });
            preferTopPanelSwitch.connect('notify::active', (widget) => {
                this._settings.set_boolean('dash-to-panel-standalone', widget.get_active());
            });

            let preferTopPanelRow = new Adw.ActionRow({
                title: _("Always Prefer Top Panel"),
                subtitle: _("Useful with Dash to Panel setting 'Keep original gnome-shell top panel'"),
                activatable_widget: multiMonitorSwitch
            });
            preferTopPanelRow.add_suffix(preferTopPanelSwitch);
            //--------------------------------------------------------------------------------------

            //Add the rows to the group
            menuDisplayGroup.add(menuPositionRow);
            menuDisplayGroup.add(menuAlignmentRow);
            menuDisplayGroup.add(multiMonitorRow);
            menuDisplayGroup.add(preferTopPanelRow);
            menuDisplayGroup.add(showActivitiesRow);

            let menuHotkeyGroup = this._createHotkeyGroup(_("Hotkey Options"), true);
            this.add(menuHotkeyGroup);

            let runnerHotkeyGroup = this._createHotkeyGroup(_("Standalone Runner Menu"), false);
            this.add(runnerHotkeyGroup);
        }

        _createHotkeyGroup(title, isMenuHotkey){
            let hotkeyGroup = new Adw.PreferencesGroup({
                title: _(title)
            });
            let enableRunnerMenuSwitch, hotkeyEnumSetting, customHotkeySetting, primaryMonitorSetting;
            if(isMenuHotkey){
                hotkeyEnumSetting = 'menu-hotkey';
                customHotkeySetting = 'toggle-arcmenu';
                primaryMonitorSetting = 'hotkey-open-primary-monitor';
            }
            else{
                hotkeyEnumSetting = 'runner-menu-hotkey';
                customHotkeySetting = 'toggle-runner-menu';
                primaryMonitorSetting = 'runner-hotkey-open-primary-monitor';

                enableRunnerMenuSwitch = new Gtk.Switch({
                    halign: Gtk.Align.END,
                    valign: Gtk.Align.CENTER,
                    active: this._settings.get_boolean('enable-standlone-runner-menu')
                });
                enableRunnerMenuSwitch.connect('notify::active', (widget) => {
                    this._settings.set_boolean('enable-standlone-runner-menu', widget.get_active());
                    if(!widget.get_active()){
                        customHotkeyRow.hide();
                        hotkeyRow.hide();
                        primaryMonitorRow.hide();
                    }
                    else{
                        hotkeyRow.show();
                        if(this._settings.get_boolean('multi-monitor'))
                            primaryMonitorRow.show();

                        if(this._settings.get_enum(hotkeyEnumSetting) === 0)
                            customHotkeyRow.hide();
                        else
                            customHotkeyRow.show();
                    }
                });
                let enableRunnerMenuRow = new Adw.ActionRow({
                    title: _("Enable a standalone Runner menu"),
                    activatable_widget: enableRunnerMenuSwitch
                });
                enableRunnerMenuRow.add_suffix(enableRunnerMenuSwitch);
                hotkeyGroup.add(enableRunnerMenuRow);
            }

            let primaryMonitorSwitch = new Gtk.Switch({
                valign: Gtk.Align.CENTER,
                active: this._settings.get_boolean(primaryMonitorSetting)
            });
            primaryMonitorSwitch.connect('notify::active', (widget) => {
                this._settings.set_boolean(primaryMonitorSetting, widget.get_active());
            });
            let primaryMonitorRow = new Adw.ActionRow({
                title: _("Open on Primary Monitor"),
                activatable_widget: primaryMonitorSwitch
            });
            primaryMonitorRow.add_suffix(primaryMonitorSwitch);

            let hotKeyOptions = new Gtk.StringList();
            if(isMenuHotkey)
                hotKeyOptions.append(_("None"));
            hotKeyOptions.append(_("Left Super Key"));
            hotKeyOptions.append(_("Custom Hotkey"));

            let hotkeyRow = new Adw.ComboRow({
                title: isMenuHotkey ? _("Menu Hotkey") : _("Runner Hotkey"),
                model: hotKeyOptions,
                selected: this._settings.get_enum(hotkeyEnumSetting)
            });

            let shortcutCell = new Gtk.ShortcutsShortcut({
                halign: Gtk.Align.START,
                valign: Gtk.Align.CENTER,
                hexpand: true,
            });
            shortcutCell.accelerator = this._settings.get_strv(customHotkeySetting).toString();

            let modifyHotkeyButton = new Gtk.Button({
                label: _("Modify Hotkey"),
                valign: Gtk.Align.CENTER,
            });

            let customHotkeyRow = new Adw.ActionRow({
                title: _("Current Hotkey"),
                activatable_widget: modifyHotkeyButton
            });
            customHotkeyRow.add_suffix(shortcutCell);
            customHotkeyRow.add_suffix(modifyHotkeyButton);
            modifyHotkeyButton.connect('clicked', () => {
                let dialog = new CustomHotkeyDialogWindow(this._settings, this);
                dialog.show();
                dialog.connect('response', (_w, response) => {
                    let customHotKeyEnum = isMenuHotkey ? 2 : 1;
                    if(response === Gtk.ResponseType.APPLY) {
                        this._settings.set_enum(hotkeyEnumSetting, 0);
                        this._settings.set_strv(customHotkeySetting, [dialog.resultsText]);
                        this._settings.set_enum(hotkeyEnumSetting, customHotKeyEnum);
                        shortcutCell.accelerator = dialog.resultsText;
                        dialog.destroy();
                    }
                    else {
                        shortcutCell.accelerator = this._settings.get_strv(customHotkeySetting).toString();
                        this._settings.set_enum(hotkeyEnumSetting, customHotKeyEnum);
                        dialog.destroy();
                    }
                });
            });

            hotkeyGroup.add(hotkeyRow);
            hotkeyGroup.add(customHotkeyRow);
            hotkeyGroup.add(primaryMonitorRow);

            hotkeyGroup.displayRows = () => {
                if(!isMenuHotkey && !enableRunnerMenuSwitch.get_active())
                    return;

                customHotkeyRow.hide();
                primaryMonitorRow.hide();

                let selected = hotkeyRow.selected;
                if(!isMenuHotkey){
                    hotkeyRow.hide();
                    selected++;
                }
                if(selected === Constants.HotKey.SUPER_L){
                    customHotkeyRow.hide();
                    if(this._settings.get_boolean('multi-monitor'))
                        primaryMonitorRow.show();
                    if(!isMenuHotkey)
                        hotkeyRow.show();
                }
                else if(selected === Constants.HotKey.CUSTOM){
                    customHotkeyRow.show();
                    if(this._settings.get_boolean('multi-monitor'))
                        primaryMonitorRow.show();
                    if(!isMenuHotkey)
                        hotkeyRow.show();
                }
            }

            hotkeyRow.connect('notify::selected', (widget) => {
                hotkeyGroup.displayRows();
                this._settings.set_enum(hotkeyEnumSetting, widget.selected);
            });
            hotkeyGroup.displayRows();

            if(!isMenuHotkey && !enableRunnerMenuSwitch.get_active()){
                customHotkeyRow.hide();
                primaryMonitorRow.hide();
                hotkeyRow.hide();
            }
            return hotkeyGroup;
        }
});

var CustomHotkeyDialogWindow = GObject.registerClass({
    Signals: {
        'response': { param_types: [GObject.TYPE_INT] },
    },
},
    class ArcMenu_CustomHotkeyDialogWindow extends Gtk.Window {
        _init(settings, parent) {
            this._settings = settings;
            this.keyEventController = new Gtk.EventControllerKey();

            super._init({
                modal: true,
                title: _("Set Custom Hotkey"),
                transient_for: parent.get_root()
            });
            let vbox = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 20,
                homogeneous: false,
                margin_top: 5,
                margin_bottom: 5,
                margin_start: 5,
                margin_end: 5,
                hexpand: true,
                halign: Gtk.Align.FILL
            });
            this.set_child(vbox);
            this._createLayout(vbox);
            this.add_controller(this.keyEventController);
            this.set_size_request(500, 250);
        }

        _createLayout(vbox) {
            let hotkeyKey = '';

            let modFrame = new Adw.PreferencesGroup()
            let modRow = new Adw.ActionRow({
                title: _("Choose Modifiers")
            });

            let buttonBox = new Gtk.Box({
                hexpand: true,
                halign: Gtk.Align.END,
                spacing: 5
            });
            modRow.add_suffix(buttonBox);
            let ctrlButton = new Gtk.ToggleButton({
                label: _("Ctrl"),
                valign: Gtk.Align.CENTER
            });
            let superButton = new Gtk.ToggleButton({
                label: _("Super"),
                valign: Gtk.Align.CENTER
            });
            let shiftButton = new Gtk.ToggleButton({
                label: _("Shift"),
                valign: Gtk.Align.CENTER
            });
            let altButton = new Gtk.ToggleButton({
                label: _("Alt"),
                valign: Gtk.Align.CENTER
            });
            ctrlButton.connect('toggled', () => {
                this.resultsText="";
                if(ctrlButton.get_active()) this.resultsText += "<Ctrl>";
                if(superButton.get_active()) this.resultsText += "<Super>";
                if(shiftButton.get_active()) this.resultsText += "<Shift>";
                if(altButton.get_active()) this.resultsText += "<Alt>";
                this.resultsText += hotkeyKey;
                resultsWidget.accelerator =  this.resultsText;
                applyButton.set_sensitive(true);
            });
            superButton.connect('toggled', () => {
                this.resultsText="";
                if(ctrlButton.get_active()) this.resultsText += "<Ctrl>";
                if(superButton.get_active()) this.resultsText += "<Super>";
                if(shiftButton.get_active()) this.resultsText += "<Shift>";
                if(altButton.get_active()) this.resultsText += "<Alt>";
                this.resultsText += hotkeyKey;
                resultsWidget.accelerator =  this.resultsText;
                applyButton.set_sensitive(true);
            });
            shiftButton.connect('toggled', () => {
                this.resultsText="";
                if(ctrlButton.get_active()) this.resultsText += "<Ctrl>";
                if(superButton.get_active()) this.resultsText += "<Super>";
                if(shiftButton.get_active()) this.resultsText += "<Shift>";
                if(altButton.get_active()) this.resultsText += "<Alt>";
                this.resultsText += hotkeyKey;
                resultsWidget.accelerator =  this.resultsText;
                applyButton.set_sensitive(true);
            });
            altButton.connect('toggled', () => {
                this.resultsText="";
                if(ctrlButton.get_active()) this.resultsText += "<Ctrl>";
                if(superButton.get_active()) this.resultsText += "<Super>";
                if(shiftButton.get_active()) this.resultsText += "<Shift>";
                if(altButton.get_active()) this.resultsText += "<Alt>";
                this.resultsText += hotkeyKey;
                resultsWidget.accelerator =  this.resultsText;
                applyButton.set_sensitive(true);
            });
            buttonBox.append(ctrlButton);
            buttonBox.append(superButton);
            buttonBox.append(shiftButton);
            buttonBox.append(altButton);
            modFrame.add(modRow);
            vbox.append(modFrame);

            let keyFrame = new Adw.PreferencesGroup();
            let keyLabel = new Gtk.Label({
                label: _("Press any key"),
                use_markup: true,
                xalign: .5,
                hexpand: true,
                halign: Gtk.Align.CENTER
            });
            vbox.append(keyLabel);
            let pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_size(Me.path + '/media/icons/prefs_icons/keyboard-symbolic.svg', 256, 72);
            let keyboardImage = Gtk.Picture.new_for_pixbuf(pixbuf);
            keyboardImage.hexpand = true;
            keyboardImage.vexpand = true;
            keyboardImage.halign = Gtk.Align.CENTER;
            keyboardImage.valign = Gtk.Align.CENTER;
            vbox.append(keyboardImage)

            let resultsRow = new Adw.ActionRow({
                title: _("New Hotkey")
            });
            let resultsWidget = new Gtk.ShortcutsShortcut({
                hexpand: true,
                halign: Gtk.Align.END
            });
            resultsRow.add_suffix(resultsWidget);
            keyFrame.add(resultsRow);

            let applyButton = new Gtk.Button({
                label: _("Apply"),
                halign: Gtk.Align.END
            });
            let context = applyButton.get_style_context();
            context.add_class('suggested-action');
            applyButton.connect('clicked', () => {
                this.emit("response", Gtk.ResponseType.APPLY);
            });
            applyButton.set_sensitive(false);

            this.keyEventController.connect('key-released', (controller, keyval, keycode, state) =>  {
                this.resultsText = "";
                let key = keyval;
                hotkeyKey = Gtk.accelerator_name(key, 0);
                if(ctrlButton.get_active()) this.resultsText += "<Ctrl>";
                if(superButton.get_active()) this.resultsText += "<Super>";
                if(shiftButton.get_active()) this.resultsText += "<Shift>";
                if(altButton.get_active()) this.resultsText += "<Alt>";
                this.resultsText += Gtk.accelerator_name(key,0);
                resultsWidget.accelerator =  this.resultsText;
                applyButton.set_sensitive(true);
            });

            vbox.append(keyFrame);
            vbox.append(applyButton);
        }
});

function getIconPixbuf(filePath){
    if (GLib.file_test(filePath, GLib.FileTest.EXISTS))
        return GdkPixbuf.Pixbuf.new_from_file_at_size(filePath, 25, 25);
    else
        return null;
}

var ButtonAppearancePage = GObject.registerClass(
    class ArcMenu_ButtonAppearancePage extends Gtk.Box {
        _init(settings) {
            super._init({
                margin_top: 10,
                margin_bottom: 10,
                margin_start: 5,
                margin_end: 5,
                spacing: 20,
                orientation: Gtk.Orientation.VERTICAL
            });
            this._settings = settings;

            let menuButtonAppearanceFrame = new Adw.PreferencesGroup({
                title: _('Menu Button')
            });

            let menuButtonAppearances = new Gtk.StringList();
            menuButtonAppearances.append(_("Icon"));
            menuButtonAppearances.append(_("Text"));
            menuButtonAppearances.append(_("Icon and Text"));
            menuButtonAppearances.append(_("Text and Icon"));
            menuButtonAppearances.append(_("Hidden"));
            let menuButtonAppearanceRow = new Adw.ComboRow({
                title: _('Appearance'),
                model: menuButtonAppearances,
                selected: -1
            });
            menuButtonAppearanceRow.connect("notify::selected", (widget) => {
                if(widget.selected === Constants.MenuButtonAppearance.NONE){
                    menuButtonOffsetRow.hide();
                    menuButtonPaddingRow.hide();
                    menuButtonCustomTextBoxRow.hide();
                }
                else if(widget.selected === Constants.MenuButtonAppearance.ICON){
                    menuButtonPaddingRow.show();
                    menuButtonCustomTextBoxRow.hide();
                    menuButtonOffsetRow.show();
                }
                else{
                    menuButtonPaddingRow.show();
                    menuButtonOffsetRow.show();
                    menuButtonCustomTextBoxRow.show();
                }
                this._settings.set_enum('menu-button-appearance', widget.selected);
            });

            let paddingScale = new Gtk.SpinButton({
                adjustment: new Gtk.Adjustment({
                    lower: -1,
                    upper: 25,
                    step_increment: 1,
                    page_increment: 1,
                    page_size: 0
                }),
                digits: 0,
                valign: Gtk.Align.CENTER,
            });
            paddingScale.set_value(this._settings.get_int('button-padding'));
            paddingScale.connect('value-changed', () => {
                this._settings.set_int('button-padding', paddingScale.get_value());
            });
            let menuButtonPaddingRow = new Adw.ActionRow({
                title: _('Padding'),
                subtitle: _("%d Default Theme Value").format(-1),
                activatable_widget: paddingScale
            });
            menuButtonPaddingRow.add_suffix(paddingScale);

            ///// Row for menu button offset /////
            let offsetScale = new Gtk.SpinButton({
                orientation: Gtk.Orientation.HORIZONTAL,
                adjustment: new Gtk.Adjustment({
                    lower: 0,
                    upper: 10, // arbitrary value
                    step_increment: 1,
                    page_increment: 1,
                    page_size: 0
                }),
                digits: 0,
                valign: Gtk.Align.CENTER,
            });
            offsetScale.set_value(this._settings.get_int('menu-button-position-offset'));
            offsetScale.connect('value-changed', () => {
                this._settings.set_int('menu-button-position-offset', offsetScale.get_value());
            });
            let menuButtonOffsetRow = new Adw.ActionRow({
                title: _('Position in Panel'),
                activatable_widget: offsetScale
            });
            menuButtonOffsetRow.add_suffix(offsetScale);
            ////////////////////

            let menuButtonCustomTextEntry = new Gtk.Entry({
                valign: Gtk.Align.CENTER,
            });
            menuButtonCustomTextEntry.set_width_chars(30);
            menuButtonCustomTextEntry.set_text(this._settings.get_string('custom-menu-button-text'));
            menuButtonCustomTextEntry.connect('changed', (widget) => {
                let customMenuButtonText = widget.get_text();
                this._settings.set_string('custom-menu-button-text', customMenuButtonText);
            });
            let menuButtonCustomTextBoxRow = new Adw.ActionRow({
                title: _('Text'),
                activatable_widget: menuButtonCustomTextEntry
            });
            menuButtonCustomTextBoxRow.add_suffix(menuButtonCustomTextEntry);

            menuButtonAppearanceFrame.add(menuButtonAppearanceRow);
            menuButtonAppearanceFrame.add(menuButtonCustomTextBoxRow);
            menuButtonAppearanceFrame.add(menuButtonPaddingRow);
            menuButtonAppearanceFrame.add(menuButtonOffsetRow);
            this.append(menuButtonAppearanceFrame);

            let menuButtonIconFrame = new Adw.PreferencesGroup({
                title: _('Icon Settings')
            });
            let menuButtonIconButton = new PW.Button({
                title: _("Browse Icons") + " ",
                icon_name: 'icon-preview-symbolic',
                icon_first: true,
                valign: Gtk.Align.CENTER,
            });
            menuButtonIconButton.connect('clicked', () => {
                let dialog = new ArcMenuIconsDialogWindow(this._settings, this);
                dialog.show();
                dialog.connect('response', () => {
                    dialog.destroy();
                });
            });
            let menuButtonIconRow = new Adw.ActionRow({
                title: _('Icon'),
                activatable_widget: menuButtonIconButton
            });
            menuButtonIconRow.add_suffix(menuButtonIconButton);
            menuButtonIconFrame.add(menuButtonIconRow);

            let menuButtonIconSizeScale = new Gtk.SpinButton({
                orientation: Gtk.Orientation.HORIZONTAL,
                adjustment: new Gtk.Adjustment({
                    lower: 14,
                    upper: 64,
                    step_increment: 1,
                    page_increment: 1,
                    page_size: 0
                }),
                digits: 0,
                valign: Gtk.Align.CENTER,
            });
            menuButtonIconSizeScale.set_value(this._settings.get_double('custom-menu-button-icon-size'));
            menuButtonIconSizeScale.connect('value-changed', () => {
                this._settings.set_double('custom-menu-button-icon-size', menuButtonIconSizeScale.get_value());
            });
            let menuButtonIconSizeRow = new Adw.ActionRow({
                title: _('Icon Size'),
                activatable_widget: menuButtonIconSizeScale
            });
            menuButtonIconSizeRow.add_suffix(menuButtonIconSizeScale);
            menuButtonIconFrame.add(menuButtonIconSizeRow);

            menuButtonAppearanceRow.selected = this._settings.get_enum('menu-button-appearance');

            this.append(menuButtonIconFrame);

            let menuButtonGroup = new Adw.PreferencesGroup({
                title: _("Menu Button Styling"),
                description: _("Results may vary with third party themes")
            });
            this.append(menuButtonGroup);

            let buttonFGColorRow = this._createButtonColorRow(_("Foreground Color"), 'menu-button-fg-color');
            menuButtonGroup.add(buttonFGColorRow);

            let buttonHoverBGColorRow = this._createButtonColorRow(_("Hover") + " " + _("Background Color"), 'menu-button-hover-bg-color');
            menuButtonGroup.add(buttonHoverBGColorRow);

            let buttonHoverFGColorRow = this._createButtonColorRow(_("Hover") + " " + _("Foreground Color"), 'menu-button-hover-fg-color');
            menuButtonGroup.add(buttonHoverFGColorRow);

            let buttonActiveBGColorRow = this._createButtonColorRow(_("Active") + " " + _("Background Color"), 'menu-button-active-bg-color');
            menuButtonGroup.add(buttonActiveBGColorRow);

            let buttonActiveFGColorRow = this._createButtonColorRow(_("Active") + " " + _("Foreground Color"), 'menu-button-active-fg-color');
            menuButtonGroup.add(buttonActiveFGColorRow);

            let buttonBorderRadiusRow = this._createSpinButtonToggleRow(_("Border Radius"), 'menu-button-border-radius', 0, 25, 'px');
            menuButtonGroup.add(buttonBorderRadiusRow);

            let buttonBorderWidthRow = this._createSpinButtonToggleRow(_("Border Width"), 'menu-button-border-width', 0, 5, 'px', _("Background colors required if set to 0"));
            menuButtonGroup.add(buttonBorderWidthRow);

            let buttonBorderColorRow = this._createButtonColorRow(_("Border Color"), 'menu-button-border-color');
            menuButtonGroup.add(buttonBorderColorRow);

            this.restoreDefaults = () => {
                menuButtonAppearanceRow.selected = 0;
                menuButtonCustomTextEntry.set_text('Applications');
                paddingScale.set_value(-1);
                menuButtonIconSizeScale.set_value(20);
                offsetScale.set_value(0);

                buttonFGColorRow.restoreDefaults();
                buttonHoverBGColorRow.restoreDefaults();
                buttonHoverFGColorRow.restoreDefaults();
                buttonActiveBGColorRow.restoreDefaults();
                buttonActiveFGColorRow.restoreDefaults();
                buttonBorderRadiusRow.restoreDefaults();
                buttonBorderWidthRow.restoreDefaults();
                buttonBorderColorRow.restoreDefaults();

                this._settings.reset('menu-button-icon');
                this._settings.reset('arc-menu-icon');
                this._settings.reset('distro-icon');
                this._settings.reset('custom-menu-button-icon');
                this._settings.reset('menu-button-position-offset');
                this._settings.reset('menu-button-fg-color');
                this._settings.reset('menu-button-hover-bg-color');
                this._settings.reset('menu-button-hover-fg-color');
                this._settings.reset('menu-button-active-bg-color');
                this._settings.reset('menu-button-active-fg-color');
                this._settings.reset('menu-button-border-radius');
                this._settings.reset('menu-button-border-width');
                this._settings.reset('menu-button-border-color');
            };
        }

        _createSpinButtonToggleRow(title, setting, lower, upper, unit, subtitle = ''){
            let [enabled, value] = this._settings.get_value(setting).deep_unpack();

            let enabledSwitch = new Gtk.Switch({
                valign: Gtk.Align.CENTER,
            });
            enabledSwitch.connect('notify::active', (widget) => {
                let [oldEnabled_, oldValue] = this._settings.get_value(setting).deep_unpack();
                this._settings.set_value(setting, new GLib.Variant('(bi)', [widget.get_active(), oldValue]));
                if(widget.get_active())
                    spinButton.set_sensitive(true);
                else
                    spinButton.set_sensitive(false);
            });
            let spinButton = new Gtk.SpinButton({
                adjustment: new Gtk.Adjustment({
                    lower,
                    upper,
                    step_increment: 1
                }),
                climb_rate: 1,
                digits: 0,
                numeric: true,
                valign: Gtk.Align.CENTER,
                value: value,
                sensitive: enabled
            });
            spinButton.connect('value-changed', (widget) => {
                let [oldEnabled, oldValue_] = this._settings.get_value(setting).deep_unpack();
                this._settings.set_value(setting, new GLib.Variant('(bi)', [oldEnabled, widget.get_value()]));
            });

            let spinRow = new Adw.ActionRow({
                title: _(title),
                subtitle: subtitle ? _(subtitle) : "",
                activatable_widget: enabledSwitch
            });
            spinRow.add_suffix(enabledSwitch);
            spinRow.add_suffix(new Gtk.Separator({
                orientation: Gtk.Orientation.VERTICAL,
                margin_top: 10,
                margin_bottom: 10
            }));
            spinRow.add_suffix(spinButton);

            enabledSwitch.set_active(enabled);

            spinRow.restoreDefaults = () => {
                let [defaultEnabled, defaultValue] = this._settings.get_default_value(setting).deep_unpack();
                enabledSwitch.set_active(defaultEnabled);
                spinButton.value = defaultValue;
            }
            return spinRow;
        }

        _createButtonColorRow(title, setting){
            let [enabled, color] = this._settings.get_value(setting).deep_unpack();

            let enabledSwitch = new Gtk.Switch({
                valign: Gtk.Align.CENTER,
            });
            enabledSwitch.connect('notify::active', (widget) => {
                let [oldEnabled_, oldColor] = this._settings.get_value(setting).deep_unpack();
                this._settings.set_value(setting, new GLib.Variant('(bs)', [widget.get_active(), oldColor]));
                if(widget.get_active())
                    colorButton.set_sensitive(true);
                else
                    colorButton.set_sensitive(false);
            });

            let colorButton = new Gtk.ColorButton({
                use_alpha: true,
                valign: Gtk.Align.CENTER,
                rgba: parseRGBA(color),
                sensitive: enabled
            });
            colorButton.connect('notify::rgba', (widget) => {
                let colorString = widget.get_rgba().to_string();
                let [oldEnabled, oldColor_] = this._settings.get_value(setting).deep_unpack();
                this._settings.set_value(setting, new GLib.Variant('(bs)', [oldEnabled, colorString]));
            });

            let colorRow = new Adw.ActionRow({
                title: _(title),
                activatable_widget: enabledSwitch
            });
            colorRow.add_suffix(enabledSwitch);
            colorRow.add_suffix(new Gtk.Separator({
                orientation: Gtk.Orientation.VERTICAL,
                margin_top: 10,
                margin_bottom: 10
            }));
            colorRow.add_suffix(colorButton);

            enabledSwitch.set_active(enabled);

            colorRow.restoreDefaults = () => {
                let [defaultEnabled, defaultColor] = this._settings.get_default_value(setting).deep_unpack();
                enabledSwitch.set_active(defaultEnabled);
                colorButton.rgba = parseRGBA(defaultColor);
            }
            return colorRow;
        }
});

var ArcMenuIconsDialogWindow = GObject.registerClass(
class ArcMenu_ArcMenuIconsDialogWindow extends PW.DialogWindow {
    _init(settings, parent) {
        this._settings = settings;
        super._init(_('ArcMenu Icons'), parent, Constants.MenuItemLocation.TOP);
        this.set_default_size(475, 400);
        this.search_enabled = false;

        let arcMenuIconsFlowBox = new PW.IconGrid();
        this.page.title = _("ArcMenu Icons");
        this.page.icon_name = 'arcmenu-logo-symbolic';
        arcMenuIconsFlowBox.connect('child-activated', ()=> {
            distroIconsBox.unselect_all();
            customIconFlowBox.unselect_all();
            let selectedChild = arcMenuIconsFlowBox.get_selected_children();
            let selectedChildIndex = selectedChild[0].get_index();
            this._settings.set_enum('menu-button-icon', Constants.MenuIcon.ARCMENU_ICON);
            this._settings.set_int('arc-menu-icon', selectedChildIndex);
        });
        this.pageGroup.add(arcMenuIconsFlowBox);

        Constants.MenuIcons.forEach((icon)=>{
            let iconName = icon.PATH.replace("/media/icons/menu_button_icons/icons/", '');
            iconName = iconName.replace(".svg", '');
            let iconImage = new Gtk.Image({
                icon_name: iconName,
                pixel_size: 36
            });
            arcMenuIconsFlowBox.add(iconImage);
        });

        this.distroIconsPage = new Adw.PreferencesPage({
            title: _("Distro Icons"),
            icon_name: 'start-here-symbolic'
        });
        let distroIconsGroup = new Adw.PreferencesGroup();
        this.distroIconsPage.add(distroIconsGroup)
        this.add(this.distroIconsPage);
        let distroIconsBox = new PW.IconGrid();
        distroIconsBox.connect('child-activated', ()=> {
            arcMenuIconsFlowBox.unselect_all();
            customIconFlowBox.unselect_all();
            let selectedChild = distroIconsBox.get_selected_children();
            let selectedChildIndex = selectedChild[0].get_index();
            this._settings.set_enum('menu-button-icon', Constants.MenuIcon.DISTRO_ICON);
            this._settings.set_int('distro-icon', selectedChildIndex);
        });
        Constants.DistroIcons.forEach((icon)=>{
            let iconImage;
            if(icon.PATH === 'start-here-symbolic'){
                iconImage = new Gtk.Image({
                    icon_name: 'start-here-symbolic',
                    pixel_size: 36
                });
            }
            else{
                let iconName1 = icon.PATH.replace("/media/icons/menu_button_icons/distro_icons/", '');
                iconName1 = iconName1.replace(".svg", '');
                iconImage = new Gtk.Image({
                    icon_name: iconName1,
                    pixel_size: 36
                });
            }
            distroIconsBox.add(iconImage);
        });
        distroIconsGroup.add(distroIconsBox);

        this.customIconPage = new Adw.PreferencesPage({
            title: _("Custom Icon"),
            icon_name: 'icon-preview-symbolic'
        });
        let customIconGroup = new Adw.PreferencesGroup();
        this.customIconPage.add(customIconGroup);
        this.add(this.customIconPage);

        let customIconBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL
        });
        let customIconFlowBox = new PW.IconGrid();
        customIconFlowBox.vexpand = false;
        customIconFlowBox.homogeneous = false;
        customIconFlowBox.connect('child-activated', ()=> {
            arcMenuIconsFlowBox.unselect_all();
            distroIconsBox.unselect_all();
            let customIconPath = this._settings.get_string('custom-menu-button-icon');
            this._settings.set_string('custom-menu-button-icon', customIconPath)
            this._settings.set_enum('menu-button-icon', Constants.MenuIcon.CUSTOM);
        });
        customIconBox.append(customIconFlowBox);
        let customIconImage = new Gtk.Image({
            gicon: Gio.icon_new_for_string(this._settings.get_string('custom-menu-button-icon')),
            pixel_size: 36
        });
        customIconFlowBox.add(customIconImage);

        let fileChooserFrame = new Adw.PreferencesGroup();
        fileChooserFrame.margin_top = 20;
        fileChooserFrame.margin_bottom = 20;
        fileChooserFrame.margin_start = 20;
        fileChooserFrame.margin_end = 20;
        let fileChooserRow = new Adw.ActionRow({
            title: _('Custom Icon'),
        });

        let fileFilter = new Gtk.FileFilter();
        fileFilter.add_pixbuf_formats();
        let fileChooserButton = new Gtk.Button({
            label: _('Browse...'),
            valign: Gtk.Align.CENTER
        });
        fileChooserButton.connect('clicked', (widget) => {
            let dialog = new Gtk.FileChooserDialog({
                title: _('Select an Icon'),
                transient_for: this.get_root(),
                modal: true,
                action: Gtk.FileChooserAction.OPEN,
            });
            if(dialog.get_parent())
                dialog.unparent();
            dialog.set_filter(fileFilter);

            dialog.add_button("_Cancel", Gtk.ResponseType.CANCEL);
            dialog.add_button("_Open", Gtk.ResponseType.ACCEPT);

            dialog.connect("response", (self, response) => {
                if(response === Gtk.ResponseType.ACCEPT){
                    arcMenuIconsFlowBox.unselect_all();
                    distroIconsBox.unselect_all();
                    customIconImage.gicon = Gio.icon_new_for_string(dialog.get_file().get_path());
                    this._settings.set_string('custom-menu-button-icon', dialog.get_file().get_path());
                    this._settings.set_enum('menu-button-icon', Constants.MenuIcon.CUSTOM);
                    customIconFlowBox.select_child(customIconFlowBox.get_child_at_index(0));
                    dialog.destroy();
                }
                else
                    dialog.destroy();
            })
            dialog.show();
        });

        fileChooserRow.add_suffix(fileChooserButton);
        fileChooserFrame.add(fileChooserRow);
        customIconBox.append(fileChooserFrame);
        customIconGroup.add(customIconBox);

        if(this._settings.get_enum('menu-button-icon') === Constants.MenuIcon.ARCMENU_ICON){
            let children = arcMenuIconsFlowBox.childrenCount;
            for(let i = 0; i < children; i++){
                if(i === this._settings.get_int('arc-menu-icon')){
                    arcMenuIconsFlowBox.select_child(arcMenuIconsFlowBox.get_child_at_index(i));
                    break;
                }
            }
        }
        else if(this._settings.get_enum('menu-button-icon') === Constants.MenuIcon.DISTRO_ICON){
            let children = distroIconsBox.childrenCount;
            for(let i = 0; i < children; i++){
                if(i === this._settings.get_int('distro-icon')){
                    distroIconsBox.select_child(distroIconsBox.get_child_at_index(i));
                    break;
                }
            }
        }
        else if(this._settings.get_enum('menu-button-icon') === Constants.MenuIcon.CUSTOM){
            customIconFlowBox.select_child(customIconFlowBox.get_child_at_index(0));
        }

        let distroInfoButtonGroup = new Adw.PreferencesGroup();
        let distroInfoButton = new PW.Button({
            icon_name: 'help-about-symbolic',
            halign: Gtk.Align.START
        });
        distroInfoButton.connect('clicked', ()=> {
            let dialog = new DistroIconsDisclaimerWindow(this._settings, this);
            dialog.connect ('response', ()=> dialog.destroy());
            dialog.show();
        });
        distroInfoButtonGroup.add(distroInfoButton);
        this.distroIconsPage.add(distroInfoButtonGroup);
        this.page.remove(this.headerGroup);

        this.setVisibleChild();
    }

    setVisibleChild(){
        if(this._settings.get_enum('menu-button-icon') === Constants.MenuIcon.ARCMENU_ICON)
            this.set_visible_page(this.page);
        else if(this._settings.get_enum('menu-button-icon') === Constants.MenuIcon.DISTRO_ICON)
            this.set_visible_page(this.distroIconsPage);
        else if(this._settings.get_enum('menu-button-icon') === Constants.MenuIcon.CUSTOM)
            this.set_visible_page(this.customIconPage);
    }
});

var DistroIconsDisclaimerWindow = GObject.registerClass(
    class ArcMenu_DistroIconsDisclaimerWindow extends Gtk.MessageDialog {
        _init(settings, parent) {
            this._settings = settings;
            super._init({
                text: "<b>" + _("Legal disclaimer for Distro Icons") + "</b>",
                use_markup: true,
                message_type: Gtk.MessageType.OTHER,
                transient_for: parent.get_root(),
                modal: true,
                buttons: Gtk.ButtonsType.OK
            });

            let vbox = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 20,
                homogeneous: false,
                margin_top: 5,
                margin_bottom: 5,
                margin_start: 5,
                margin_end: 5,
            });
            this.get_content_area().append(vbox);
            this._createLayout(vbox);
        }

        _createLayout(vbox) {
            let scrollWindow = new Gtk.ScrolledWindow({
                min_content_width: 500,
                max_content_width: 500,
                min_content_height: 400,
                max_content_height: 400,
                hexpand: false,
                halign: Gtk.Align.START,
            });
            scrollWindow.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC);
            let frame = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                hexpand: false,
                halign: Gtk.Align.START
            });

            let bodyLabel = new Gtk.Label({
                label: Constants.DistroIconsDisclaimer,
                use_markup: true,
                hexpand: false,
                halign: Gtk.Align.START,
                wrap: true
            });
            bodyLabel.set_size_request(500,-1);

            frame.append(bodyLabel);
            scrollWindow.set_child(frame);
            vbox.append(scrollWindow);
        }
});

var MenuLayoutPage = GObject.registerClass(
    class ArcMenu_MenuLayoutPage extends Adw.PreferencesPage {
        _init(settings) {
            super._init({
                title: _('Layouts'),
                icon_name: 'menu-layouts-symbolic',
                name: 'MenuLayoutsPage'
            });
            this._settings = settings;

            let mainGroup = new Adw.PreferencesGroup();
            this.add(mainGroup);

            let mainBox = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                margin_start: 5,
                margin_end: 5,
                spacing: 20,
                vexpand: true,
                valign: Gtk.Align.FILL
            });

            this.mainLeaflet = new Adw.Leaflet({
                homogeneous: true,
                transition_type: Adw.LeafletTransitionType.SLIDE,
                can_navigate_back: true,
                can_navigate_forward: false,
                can_unfold: false,
            });

            this.subLeaflet = new Adw.Leaflet({
                homogeneous: true,
                transition_type: Adw.LeafletTransitionType.SLIDE,
                can_navigate_back: false,
                can_navigate_forward: false,
                can_unfold: false,
            });

            let leafletPage = this.mainLeaflet.append(mainBox);
            leafletPage.name = "MainView";

            leafletPage = this.mainLeaflet.append(this.subLeaflet);
            leafletPage.name = "SubView";

            mainGroup.add(this.mainLeaflet);

            let currentLayoutGroup = new Adw.PreferencesGroup({
                title: _("Current Menu Layout"),
            });
            let currentLayoutName = this.getMenuLayoutName(this._settings.get_enum('menu-layout'));
            let currentLayoutImagePath = this.getMenuLayoutImagePath(this._settings.get_enum('menu-layout'));
            let imagePixelSize = 155;
            let currentLayoutBoxRow = new PW.MenuLayoutRow(currentLayoutName, currentLayoutImagePath, imagePixelSize);

            currentLayoutBoxRow.connect('activated', () => {
                this.displayLayoutTweaksPage();
            });

            currentLayoutGroup.add(currentLayoutBoxRow);
            mainBox.append(currentLayoutGroup);

            let availableLayoutGroup = new Adw.PreferencesGroup({
                title: _("Available Menu Layouts"),
            });
            mainBox.append(availableLayoutGroup);

            Constants.MenuStyles.STYLES.forEach((style) => {
                let tile = new PW.MenuLayoutRow(_("%s Menu Layouts").format(style.TITLE) , style.IMAGE, 46, style);
                availableLayoutGroup.add(tile);

                let menuLayoutsBox = new MenuLayoutCategoryPage(this._settings, this, tile, style.TITLE);
                menuLayoutsBox.connect('menu-layout-response', (dialog, response) => {
                    if(response === Gtk.ResponseType.APPLY) {
                        this._settings.set_enum('menu-layout', dialog.menuLayout);
                        currentLayoutBoxRow.label.label = "<b>" + this.getMenuLayoutName(dialog.menuLayout) + "</b>";
                        tweaksLabel.label = this.getMenuLayoutTweaksName(dialog.menuLayout);
                        currentLayoutBoxRow.image.gicon = Gio.icon_new_for_string(this.getMenuLayoutImagePath(dialog.menuLayout));
                        this.mainLeaflet.set_visible_child_name("MainView");
                    }
                    if(response === Gtk.ResponseType.CANCEL){
                        this.mainLeaflet.set_visible_child_name("MainView");
                        menuLayoutsBox.clearSelection();
                    }
                });
                leafletPage = this.subLeaflet.append(menuLayoutsBox);
                leafletPage.name = `Layout_${style.TITLE}`;
                tile.connect('activated', ()=> {
                    this.subLeaflet.set_visible_child_name(`Layout_${style.TITLE}`);
                    this.mainLeaflet.set_visible_child_name("SubView");
                });
            });

            this.layoutsTweaksPage = new LayoutTweaks.tweaks.TweaksPage(this._settings, this.getMenuLayoutTweaksName(this._settings.get_enum('menu-layout')));
            this.layoutsTweaksPage.connect("response", (page, response) => {
                if(response === -20)
                    this.mainLeaflet.set_visible_child_name("MainView");
            });
            let tweaksLabel = new Gtk.Label({
                label: this.getMenuLayoutTweaksName(this._settings.get_enum('menu-layout')),
                use_markup: true,
                halign: Gtk.Align.END,
                vexpand: true,
                hexpand: true
            });

            leafletPage = this.subLeaflet.append(this.layoutsTweaksPage);
            leafletPage.name = "LayoutsTweaks";
            this.mainLeaflet.set_visible_child_name("MainView");

            this.mainLeaflet.connect('notify::visible-child', () => {
                const visibleChild = this.subLeaflet.get_visible_child();
                if(visibleChild instanceof MenuLayoutCategoryPage)
                    visibleChild.clearSelection();
            })
    }

    displayLayoutTweaksPage(){
        let layoutName = this.getMenuLayoutTweaksName(this._settings.get_enum('menu-layout'));
        this.layoutsTweaksPage.setActiveLayout(this._settings.get_enum('menu-layout'), layoutName);
        this.subLeaflet.set_visible_child_name("LayoutsTweaks");
        this.mainLeaflet.set_visible_child_name("SubView");
    }

    displayLayouts(){
        this.mainLeaflet.set_visible_child_name("MainView");
    }

    displayRunnerTweaksPage(){
        if(!this.runnerTweaksPage){
            let activeLayoutName = this.getMenuLayoutTweaksName(Constants.MenuLayout.RUNNER);
            this.runnerTweaksPage = new LayoutTweaks.tweaks.TweaksPage(this._settings, activeLayoutName);
            let leafletPage = this.subLeaflet.append(this.runnerTweaksPage);
            leafletPage.name = "RunnerTweaks";
            this.runnerTweaksPage.connect("response", (page, response) => {
                if(response === -20)
                    this.mainLeaflet.set_visible_child_name("MainView");
            });
            this.runnerTweaksPage.setActiveLayout(Constants.MenuLayout.RUNNER);
        }
        this.subLeaflet.set_visible_child_name("RunnerTweaks");
        this.mainLeaflet.set_visible_child_name("SubView");
    }

    getMenuLayoutName(index){
        for(let styles of Constants.MenuStyles.STYLES){
            for(let style of styles.MENU_TYPE){
                if(style.LAYOUT == index){
                    return _(style.TITLE);
                }
            }
        }
    }

    getMenuLayoutTweaksName(index){
        for(let styles of Constants.MenuStyles.STYLES){
            for(let style of styles.MENU_TYPE){
                if(style.LAYOUT == index){
                    return _("%s Layout Tweaks").format(style.TITLE);
                }
            }
        }
    }

    getMenuLayoutImagePath(index){
        for(let styles of Constants.MenuStyles.STYLES){
            for(let style of styles.MENU_TYPE){
                if(style.LAYOUT == index){
                    return style.IMAGE;
                }
            }
        }
    }
});

var MenuLayoutCategoryPage = GObject.registerClass({
    Signals: {
        'menu-layout-response': { param_types: [GObject.TYPE_INT] },
    },
},  class ArcMenu_MenuLayoutCategoryPage extends Gtk.Box {
        _init(settings, parent, tile, title) {
            super._init({
                margin_start: 5,
                margin_end: 5,
                spacing: 20,
                orientation: Gtk.Orientation.VERTICAL
            });

            this._parent = parent;
            this._settings = settings;
            this.menuLayout = this._settings.get_enum('menu-layout');
            this.layoutStyle = tile.layout;

            this.maxColumns = tile.layout.length > 3 ? 3 : tile.layout.length;
            this.styles = tile.layout;

            let layoutsFrame = new Adw.PreferencesGroup();
            let layoutsRow = new Adw.PreferencesRow({
                selectable: false,
                activatable: false
            });

            let buttonBox = new Gtk.Box({
                spacing: 10,
                margin_bottom: 10
            });

            this.applyButton = new Gtk.Button({
                label: _("Apply"),
                hexpand: false,
                halign: Gtk.Align.END
            });
            let context = this.applyButton.get_style_context();
            context.add_class('suggested-action');

            this.applyButton.connect('clicked', ()=> {
                this.clearSelection();
                this.emit('menu-layout-response', Gtk.ResponseType.APPLY);
            });

            let backButton = new PW.Button({
                icon_name: 'go-previous-symbolic',
                title: _("Back"),
                icon_first: true,
                halign: Gtk.Align.START
            });
            context = backButton.get_style_context();
            context.add_class('suggested-action');

            backButton.connect('clicked', ()=> {
                this.clearSelection();
                this.emit('menu-layout-response', Gtk.ResponseType.CANCEL);
            });
            buttonBox.append(backButton);

            let chooseNewLayoutLabel = new Gtk.Label({
                label: "<b>" +  _("%s Menu Layouts").format(title) + "</b>",
                use_markup: true,
                halign: Gtk.Align.CENTER,
                hexpand: true
            });
            buttonBox.append(chooseNewLayoutLabel);
            buttonBox.append(this.applyButton);

            this.applyButton.set_sensitive(false);

            this.append(buttonBox);
            this.append(layoutsFrame);

            this._tileGrid = new Gtk.FlowBox({
                row_spacing: 4,
                column_spacing: 4,
                margin_bottom: 5,
                margin_top: 5,
                hexpand: true,
                halign: Gtk.Align.CENTER,
                max_children_per_line: this.maxColumns,
                homogeneous: true,
                selection_mode: Gtk.SelectionMode.NONE
            });

            this.styles.forEach((style) => {
                this._addTile(style.TITLE, style.IMAGE, style.LAYOUT);
            });
            layoutsRow.set_child(this._tileGrid);
            layoutsFrame.add(layoutsRow);

            this._tileGrid.connect('selected-children-changed', () => {
                this.applyButton.set_sensitive(true);
            });
        }

        clearSelection(){
            if(this.activeButton)
                this.activeButton.active = false;
            this.applyButton.set_sensitive(false);
        }

        _addTile(name, image, layout) {
            let tile = new PW.Tile(name, image, layout);

            if(!this.firstTileButton)
                this.firstTileButton = tile;
            else
                tile.group = this.firstTileButton;

            tile.connect("toggled", () => {
                this.activeButton = tile;
                this.menuLayout = tile.layout;
                this.applyButton.set_sensitive(true);
            });

            this._tileGrid.insert(tile, -1);
        }
});

var MenuSettingsGeneralPage = GObject.registerClass(
    class ArcMenu_MenuSettingsGeneralPage extends Gtk.Box {
    _init(settings) {
        super._init({
            margin_top: 10,
            margin_bottom: 10,
            margin_start: 5,
            margin_end: 5,
            spacing: 20,
            orientation: Gtk.Orientation.VERTICAL
        });
        this._settings = settings;

        let menuSizeFrame = new Adw.PreferencesGroup({
            title: _("Menu Size")
        });
        this.append(menuSizeFrame);

        //find the greatest screen height of all monitors
        //use that value to set Menu Height cap
        let display = Gdk.Display.get_default();
        let monitors = display.get_monitors();
        let nMonitors = monitors.get_n_items();
        let greatestHeight = 0;
        let scaleFactor = 1;
        for (let i = 0; i < nMonitors; i++) {
            let monitor = monitors.get_item(i);
            let monitorHeight = monitor.get_geometry().height;
            if(monitorHeight > greatestHeight){
                scaleFactor = monitor.get_scale_factor();
                greatestHeight = monitorHeight;
            }
        }
        let monitorHeight = greatestHeight * scaleFactor;
        monitorHeight = Math.round((monitorHeight * 8) / 10);

        let heightSpinButton = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({
                lower: 300, upper: monitorHeight, step_increment: 25, page_increment: 50, page_size: 0,
            }),
            climb_rate: 25,
            digits: 0,
            numeric: true,
            valign: Gtk.Align.CENTER,
        });
        heightSpinButton.set_value(this._settings.get_int('menu-height'));
        heightSpinButton.connect('value-changed', (widget) => {
            this._settings.set_int('menu-height', widget.get_value());
        });
        let heightRow = new Adw.ActionRow({
            title: _('Height'),
            activatable_widget: heightSpinButton
        });
        heightRow.add_suffix(heightSpinButton);
        menuSizeFrame.add(heightRow);

        let menuWidthSpinButton = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({
                lower: 175, upper: 500, step_increment: 25, page_increment: 50, page_size: 0,
            }),
            climb_rate: 25,
            digits: 0,
            numeric: true,
            valign: Gtk.Align.CENTER,
        });
        menuWidthSpinButton.set_value(this._settings.get_int('left-panel-width'));
        menuWidthSpinButton.connect('value-changed', (widget) => {
            this._settings.set_int('left-panel-width', widget.get_value());
        });
        let menuWidthRow = new Adw.ActionRow({
            title: _('Left-Panel Width'),
            subtitle: _("Traditional Layouts"),
            activatable_widget: menuWidthSpinButton
        });
        menuWidthRow.add_suffix(menuWidthSpinButton);
        menuSizeFrame.add(menuWidthRow);

        let rightPanelWidthSpinButton = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({
                lower: 200,upper: 500, step_increment: 25, page_increment: 50, page_size: 0,
            }),
            climb_rate: 25,
            valign: Gtk.Align.CENTER,
            digits: 0,
            numeric: true,
        });
        rightPanelWidthSpinButton.set_value(this._settings.get_int('right-panel-width'));
        rightPanelWidthSpinButton.connect('value-changed', (widget) => {
            this._settings.set_int('right-panel-width', widget.get_value());
        });
        let rightPanelWidthRow = new Adw.ActionRow({
            title: _('Right-Panel Width'),
            subtitle: _("Traditional Layouts"),
            activatable_widget: rightPanelWidthSpinButton
        });
        rightPanelWidthRow.add_suffix(rightPanelWidthSpinButton);
        menuSizeFrame.add(rightPanelWidthRow);

        let widthSpinButton = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({
                lower: -350, upper: 600, step_increment: 25, page_increment: 50, page_size: 0,
            }),
            valign: Gtk.Align.CENTER,
            climb_rate: 25,
            digits: 0,
            numeric: true,
        });
        widthSpinButton.set_value(this._settings.get_int('menu-width-adjustment'));
        widthSpinButton.connect('value-changed', (widget) => {
            this._settings.set_int('menu-width-adjustment', widget.get_value());
        });
        let widthRow = new Adw.ActionRow({
            title: _('Width Offset'),
            subtitle: _("Non-Traditional Layouts"),
            activatable_widget: widthSpinButton
        });
        widthRow.add_suffix(widthSpinButton);
        menuSizeFrame.add(widthRow);

        let generalSettingsFrame = new Adw.PreferencesGroup({
            title: _('General Settings')
        });
        this.append(generalSettingsFrame);

        let menuLocations = new Gtk.StringList();
        menuLocations.append(_('Off'));
        menuLocations.append(_('Top Centered'));
        menuLocations.append(_('Bottom Centered'));
        let menuLocationRow = new Adw.ComboRow({
            title: _("Override Menu Location"),
            model: menuLocations,
            selected: this._settings.get_enum('force-menu-location')
        });
        menuLocationRow.connect("notify::selected", (widget) => {
            this._settings.set_enum('force-menu-location', widget.selected)
        });
        generalSettingsFrame.add(menuLocationRow);

        let appDescriptionsSwitch = new Gtk.Switch({
            valign: Gtk.Align.CENTER,
        });
        appDescriptionsSwitch.set_active(this._settings.get_boolean('apps-show-extra-details'));
        appDescriptionsSwitch.connect('notify::active', (widget) => {
            this._settings.set_boolean('apps-show-extra-details', widget.get_active())
        });
        let appDescriptionsRow = new Adw.ActionRow({
            title: _("Show Application Descriptions"),
            activatable_widget: appDescriptionsSwitch
        });
        appDescriptionsRow.add_suffix(appDescriptionsSwitch);
        generalSettingsFrame.add(appDescriptionsRow);

        let iconTypes = new Gtk.StringList();
        iconTypes.append(_('Full Color'));
        iconTypes.append(_('Symbolic'));
        let categoryIconTypeRow = new Adw.ComboRow({
            title: _('Category Icon Type'),
            subtitle: _("Some icon themes may not include selected icon type"),
            model: iconTypes,
            selected: this._settings.get_enum('category-icon-type')
        });
        categoryIconTypeRow.connect('notify::selected', (widget) => {
            this._settings.set_enum('category-icon-type', widget.selected);
        });
        generalSettingsFrame.add(categoryIconTypeRow);

        let shortcutsIconTypeRow = new Adw.ComboRow({
            title: _('Shortcuts Icon Type'),
            subtitle: _("Some icon themes may not include selected icon type"),
            model: iconTypes,
            selected: this._settings.get_enum('shortcut-icon-type')
        });
        shortcutsIconTypeRow.connect('notify::selected', (widget) => {
            this._settings.set_enum('shortcut-icon-type', widget.selected);
        });
        generalSettingsFrame.add(shortcutsIconTypeRow);

        let vertSeparatorSwitch = new Gtk.Switch({
            valign: Gtk.Align.CENTER,
            active: this._settings.get_boolean('vert-separator')
        });
        vertSeparatorSwitch.connect('notify::active', (widget) => {
            this._settings.set_boolean('vert-separator', widget.get_active());
        });
        let vertSeparatorRow = new Adw.ActionRow({
            title: _('Vertical Separator'),
            subtitle: _("Traditional Layouts"),
            activatable_widget:  vertSeparatorSwitch
        });
        vertSeparatorRow.add_suffix(vertSeparatorSwitch);
        generalSettingsFrame.add(vertSeparatorRow);

        let iconsSizeFrame = new Adw.PreferencesGroup({
            title: _("Icon Sizes"),
            description: _("Modify the icon size of various menu elements.")
        });
        this.append(iconsSizeFrame);

        let iconSizes = new Gtk.StringList();
        iconSizes.append(_('Default'));
        iconSizes.append(_('Small') + " - " + _('Square'));
        iconSizes.append(_('Medium') + " - " + _('Square'));
        iconSizes.append(_('Large') + " - " + _('Square'));
        iconSizes.append(_('Small') + " - " + _('Wide'));
        iconSizes.append(_('Medium') + " - " + _('Wide'));
        iconSizes.append(_('Large') + " - " + _('Wide'));
        let gridIconsSizeRow = new Adw.ComboRow({
            title: _("Grid Icons"),
            model: iconSizes,
            selected: this._settings.get_enum('menu-item-grid-icon-size')
        });
        gridIconsSizeRow.connect('notify::selected', (widget) => {
            this._settings.set_enum('menu-item-grid-icon-size', widget.selected);
        });
        iconsSizeFrame.add(gridIconsSizeRow);

        let menuItemIconSizeRow = this.createIconSizeRow(_("Categories &amp; Applications"), 'menu-item-icon-size');
        iconsSizeFrame.add(menuItemIconSizeRow);
        let buttonIconSizeRow = this.createIconSizeRow(_("Buttons"), 'button-item-icon-size');
        iconsSizeFrame.add(buttonIconSizeRow);
        let quicklinksIconSizeRow = this.createIconSizeRow(_("Quick Links"),'quicklinks-item-icon-size');
        iconsSizeFrame.add(quicklinksIconSizeRow);
        let miscIconSizeRow = this.createIconSizeRow(_("Misc"), 'misc-item-icon-size');
        iconsSizeFrame.add(miscIconSizeRow);

        this.restoreDefaults = () => {
            heightSpinButton.set_value(this._settings.get_default_value('menu-height').unpack());
            widthSpinButton.set_value(this._settings.get_default_value('menu-width-adjustment').unpack());
            menuWidthSpinButton.set_value(this._settings.get_default_value('left-panel-width').unpack());
            rightPanelWidthSpinButton.set_value(this._settings.get_default_value('right-panel-width').unpack());
            vertSeparatorSwitch.set_active(this._settings.get_default_value('vert-separator').unpack());
            gridIconsSizeRow.selected = 0;
            menuItemIconSizeRow.selected = 0;
            buttonIconSizeRow.selected = 0;
            quicklinksIconSizeRow.selected = 0;
            miscIconSizeRow.selected = 0;
            appDescriptionsSwitch.set_active(this._settings.get_default_value('apps-show-extra-details').unpack());
            menuLocationRow.selected = 0;
            categoryIconTypeRow.selected = 0;
            shortcutsIconTypeRow.selected = 1;
        };
    }

    createIconSizeRow(title, setting){
        let iconSizes = new Gtk.StringList();
        iconSizes.append(_('Default'));
        iconSizes.append(_('Extra Small'));
        iconSizes.append(_('Small'));
        iconSizes.append(_('Medium'));
        iconSizes.append(_('Large'));
        iconSizes.append(_('Extra Large'));

        let iconsSizeRow = new Adw.ComboRow({
            title: _(title),
            model: iconSizes,
            selected: this._settings.get_enum(setting)
        });
        iconsSizeRow.connect('notify::selected', (widget) => {
            this._settings.set_enum(setting, widget.selected);
        });
        return iconsSizeRow;
    }
});

var MenuSettingsFineTunePage = GObject.registerClass(
    class ArcMenu_MenuSettingsFineTunePage extends Gtk.Box {
    _init(settings) {
        super._init({
            margin_top: 10,
            margin_bottom: 10,
            margin_start: 5,
            margin_end: 5,
            spacing: 20,
            orientation: Gtk.Orientation.VERTICAL
        });
        this._settings = settings;
        this.disableFadeEffect = this._settings.get_boolean('disable-scrollview-fade-effect');
        this.alphabetizeAllPrograms = this._settings.get_boolean('alphabetize-all-programs')
        this.multiLinedLabels = this._settings.get_boolean('multi-lined-labels');
        this.disableTooltips = this._settings.get_boolean('disable-tooltips');
        this.disableRecentApps = this._settings.get_boolean('disable-recently-installed-apps');
        this.showHiddenRecentFiles = this._settings.get_boolean('show-hidden-recent-files');

        let fadeEffectFrame = new Adw.PreferencesGroup();
        let fadeEffectSwitch = new Gtk.Switch({
            valign: Gtk.Align.CENTER
        });
        fadeEffectSwitch.set_active(this._settings.get_boolean('disable-scrollview-fade-effect'));
        fadeEffectSwitch.connect('notify::active', (widget) => {
            this._settings.set_boolean('disable-scrollview-fade-effect', widget.get_active());
        });
        let fadeEffectRow = new Adw.ActionRow({
            title: _("Disable ScrollView Fade Effects"),
            activatable_widget: fadeEffectSwitch
        });
        fadeEffectRow.add_suffix(fadeEffectSwitch);
        fadeEffectFrame.add(fadeEffectRow);
        this.append(fadeEffectFrame);

        let tooltipFrame = new Adw.PreferencesGroup();
        let tooltipSwitch = new Gtk.Switch({
            valign: Gtk.Align.CENTER
        });
        tooltipSwitch.set_active(this.disableTooltips);
        tooltipSwitch.connect('notify::active', (widget) => {
            this._settings.set_boolean('disable-tooltips', widget.get_active());
        });
        let tooltipRow = new Adw.ActionRow({
            title: _("Disable Tooltips"),
            activatable_widget: tooltipSwitch
        });
        tooltipRow.add_suffix(tooltipSwitch);
        tooltipFrame.add(tooltipRow);
        this.append(tooltipFrame);

        let alphabetizeAllProgramsFrame = new Adw.PreferencesGroup();
        let alphabetizeAllProgramsSwitch = new Gtk.Switch({
            valign: Gtk.Align.CENTER
        });
        alphabetizeAllProgramsSwitch.set_active(this._settings.get_boolean('alphabetize-all-programs'));
        alphabetizeAllProgramsSwitch.connect('notify::active', (widget) => {
            this._settings.set_boolean('alphabetize-all-programs', widget.get_active());
        });
        let alphabetizeAllProgramsRow = new Adw.ActionRow({
            title: _("Alphabetize 'All Programs' Category"),
            activatable_widget: alphabetizeAllProgramsSwitch
        });
        alphabetizeAllProgramsRow.add_suffix(alphabetizeAllProgramsSwitch);
        alphabetizeAllProgramsFrame.add(alphabetizeAllProgramsRow);
        this.append(alphabetizeAllProgramsFrame);

        let hiddenFilesFrame = new Adw.PreferencesGroup();
        let hiddenFilesSwitch = new Gtk.Switch({
            valign: Gtk.Align.CENTER
        });
        hiddenFilesSwitch.set_active(this._settings.get_boolean('show-hidden-recent-files'));
        hiddenFilesSwitch.connect('notify::active', (widget) => {
            this._settings.set_boolean('show-hidden-recent-files', widget.get_active());
        });
        let hiddenFilesRow = new Adw.ActionRow({
            title: _("Show Hidden Recent Files"),
            activatable_widget: hiddenFilesSwitch
        });
        hiddenFilesRow.add_suffix(hiddenFilesSwitch);
        hiddenFilesFrame.add(hiddenFilesRow);
        this.append(hiddenFilesFrame);

        let multiLinedLabelFrame = new Adw.PreferencesGroup();
        let multiLinedLabelSwitch = new Gtk.Switch({
            valign: Gtk.Align.CENTER
        });
        multiLinedLabelSwitch.set_active(this._settings.get_boolean('multi-lined-labels'));
        multiLinedLabelSwitch.connect('notify::active', (widget) => {
            this._settings.set_boolean('multi-lined-labels', widget.get_active());
        });
        let multiLinedLabelInfoButton = new PW.Button({
                icon_name: 'help-about-symbolic'
        });
        multiLinedLabelInfoButton.connect('clicked', ()=> {
            let dialog = new Gtk.MessageDialog({
                text: "<b>" + _("Multi-Lined Labels") + '</b>\n' + _('Enable/Disable multi-lined labels on large application icon layouts.'),
                use_markup: true,
                buttons: Gtk.ButtonsType.OK,
                message_type: Gtk.MessageType.WARNING,
                transient_for: this.get_root(),
                modal: true
            });
            dialog.connect('response', (widget, response) => {
                dialog.destroy();
            });
            dialog.show();
        });
        let multiLinedLabelRow = new Adw.ActionRow({
            title: _("Multi-Lined Labels"),
            activatable_widget: multiLinedLabelSwitch
        });
        multiLinedLabelRow.add_suffix(multiLinedLabelSwitch);
        multiLinedLabelRow.add_suffix(multiLinedLabelInfoButton);
        multiLinedLabelFrame.add(multiLinedLabelRow);
        this.append(multiLinedLabelFrame);

        let recentAppsFrame = new Adw.PreferencesGroup();
        let recentAppsSwitch = new Gtk.Switch({
            valign: Gtk.Align.CENTER,
        });
        recentAppsSwitch.connect('notify::active', (widget) => {
            if(widget.get_active()){
                clearRecentAppsRow.hide();
            }
            else{
                clearRecentAppsRow.show();
            }
            this._settings.set_boolean('disable-recently-installed-apps', widget.get_active());
        });
        let recentAppsRow = new Adw.ActionRow({
            title: _("Disable New Apps Tracker"),
            activatable_widget: recentAppsSwitch
        });
        recentAppsRow.add_suffix(recentAppsSwitch);
        recentAppsFrame.add(recentAppsRow);
        this.append(recentAppsFrame);

        let clearRecentAppsButton = new Gtk.Button({
            halign: Gtk.Align.END,
            valign: Gtk.Align.CENTER,
            label: _("Clear All"),
        });
        let sensitive = this._settings.get_strv('recently-installed-apps').length > 0;
        clearRecentAppsButton.set_sensitive(sensitive);
        clearRecentAppsButton.connect('clicked', (widget) => {
            clearRecentAppsButton.set_sensitive(false);
            this._settings.reset('recently-installed-apps');
        });
        let clearRecentAppsRow = new Adw.ActionRow({
            title: _("Clear Apps Marked 'New'"),
            activatable_widget: clearRecentAppsButton
        });
        clearRecentAppsRow.add_suffix(clearRecentAppsButton);
        recentAppsFrame.add(clearRecentAppsRow);

        recentAppsSwitch.set_active(this._settings.get_boolean('disable-recently-installed-apps'));

        this.restoreDefaults = () => {
            this.alphabetizeAllPrograms = this._settings.get_default_value('alphabetize-all-programs').unpack();
            this.multiLinedLabels = this._settings.get_default_value('multi-lined-labels').unpack();
            this.disableTooltips = this._settings.get_default_value('disable-tooltips').unpack();
            this.disableFadeEffect = this._settings.get_default_value('disable-scrollview-fade-effect').unpack();
            this.disableRecentApps = this._settings.get_default_value('disable-recently-installed-apps').unpack();
            this.showHiddenRecentFiles = this._settings.get_default_value('show-hidden-recent-files').unpack();
            alphabetizeAllProgramsSwitch.set_active(this.alphabetizeAllPrograms);
            multiLinedLabelSwitch.set_active(this.multiLinedLabels);
            tooltipSwitch.set_active(this.disableTooltips);
            fadeEffectSwitch.set_active(this.disableFadeEffect);
            recentAppsSwitch.set_active(this.disableRecentApps);
            hiddenFilesSwitch.set_active(this.showHiddenRecentFiles);
        };
    }
});

var MenuSettingsSearchOptionsPage = GObject.registerClass(
    class ArcMenu_MenuSettingsSearchOptionsPage extends Gtk.Box {
    _init(settings) {
        super._init({
            margin_top: 10,
            margin_bottom: 10,
            margin_start: 5,
            margin_end: 5,
            spacing: 20,
            orientation: Gtk.Orientation.VERTICAL
        });
        this._settings = settings;
        this.searchResultsDetails = this._settings.get_boolean('show-search-result-details');
        this.openWindowsSearchProvider = this._settings.get_boolean('search-provider-open-windows');
        this.recentFilesSearchProvider = this._settings.get_boolean('search-provider-recent-files');
        this.highlightSearchResultTerms = this._settings.get_boolean('highlight-search-result-terms');
        this.maxSearchResults = this._settings.get_int('max-search-results');

        let searchProvidersFrame = new Adw.PreferencesGroup({
            title: _("Extra Search Providers")
        });

        let openWindowsSwitch = new Gtk.Switch({
            valign: Gtk.Align.CENTER
        });
        openWindowsSwitch.set_active(this.openWindowsSearchProvider);
        openWindowsSwitch.connect('notify::active', (widget) => {
            this._settings.set_boolean('search-provider-open-windows', widget.get_active());
        });
        let openWindowsRow = new Adw.ActionRow({
            title: _("Search for open windows across all workspaces"),
            activatable_widget: openWindowsSwitch
        });
        openWindowsRow.add_suffix(openWindowsSwitch);
        searchProvidersFrame.add(openWindowsRow);

        let recentFilesSwitch = new Gtk.Switch({
            valign: Gtk.Align.CENTER
        });
        recentFilesSwitch.set_active(this.recentFilesSearchProvider);
        recentFilesSwitch.connect('notify::active', (widget) => {
            this._settings.set_boolean('search-provider-recent-files', widget.get_active());
        });
        let recentFilesRow = new Adw.ActionRow({
            title: _("Search for recent files"),
            activatable_widget: recentFilesSwitch
        });
        recentFilesRow.add_suffix(recentFilesSwitch);
        searchProvidersFrame.add(recentFilesRow);
        this.append(searchProvidersFrame);

        let searchOptionsFrame = new Adw.PreferencesGroup({
            title: _("Search Options")
        });
        let descriptionsSwitch = new Gtk.Switch({
            valign: Gtk.Align.CENTER
        });
        descriptionsSwitch.set_active(this.searchResultsDetails);
        descriptionsSwitch.connect('notify::active', (widget) => {
            this._settings.set_boolean('show-search-result-details', widget.get_active());
        });
        let descriptionsRow = new Adw.ActionRow({
            title: _("Show descriptions of search results"),
            activatable_widget: descriptionsSwitch
        });
        descriptionsRow.add_suffix(descriptionsSwitch);
        searchOptionsFrame.add(descriptionsRow);

        let highlightSearchResultSwitch = new Gtk.Switch({
            valign: Gtk.Align.CENTER
        });
        highlightSearchResultSwitch.set_active(this.highlightSearchResultTerms);
        highlightSearchResultSwitch.connect('notify::active', (widget) => {
            this._settings.set_boolean('highlight-search-result-terms', widget.get_active());
        });

        let highlightSearchResultRow = new Adw.ActionRow({
            title: _("Highlight search result terms"),
            activatable_widget: highlightSearchResultSwitch
        });
        highlightSearchResultRow.add_suffix(highlightSearchResultSwitch);
        searchOptionsFrame.add(highlightSearchResultRow);

        let maxSearchResultsScale = new Gtk.SpinButton({
            orientation: Gtk.Orientation.HORIZONTAL,
            adjustment: new Gtk.Adjustment({
                lower: 2,
                upper: 10,
                step_increment: 1,
                page_increment: 1,
                page_size: 0
            }),
            digits: 0,
            valign: Gtk.Align.CENTER,
        });
        let maxSearchResultsRow = new Adw.ActionRow({
            title: _('Max Search Results'),
            activatable_widget: maxSearchResultsScale
        });
        maxSearchResultsScale.set_value(this.maxSearchResults);
        maxSearchResultsScale.connect('value-changed', (widget) => {
            this._settings.set_int('max-search-results', widget.get_value());
        });
        maxSearchResultsRow.add_suffix(maxSearchResultsScale);
        searchOptionsFrame.add(maxSearchResultsRow);
        this.append(searchOptionsFrame);

        this.restoreDefaults = () => {
            this.searchResultsDetails = this._settings.get_default_value('show-search-result-details').unpack();
            this.openWindowsSearchProvider = this._settings.get_default_value('search-provider-open-windows').unpack();
            this.recentFilesSearchProvider = this._settings.get_default_value('search-provider-recent-files').unpack();
            this.highlightSearchResultTerms = this._settings.get_default_value('highlight-search-result-terms').unpack();
            this.maxSearchResults = this._settings.get_default_value('max-search-results').unpack();
            descriptionsSwitch.set_active(this.searchResultsDetails);
            openWindowsSwitch.set_active(this.openWindowsSearchProvider);
            recentFilesSwitch.set_active(this.recentFilesSearchProvider);
            highlightSearchResultSwitch.set_active(this.highlightSearchResultTerms);
            maxSearchResultsScale.set_value(this.maxSearchResults);
        };
    }
});

var MenuSettingsListOtherPage = GObject.registerClass(
    class ArcMenu_MenuSettingsListOtherPage extends Gtk.Box {
    _init(settings, listType) {
        super._init({
            margin_top: 10,
            margin_bottom: 10,
            margin_start: 5,
            margin_end: 5,
            spacing: 20,
            orientation: Gtk.Orientation.VERTICAL
        });
        this.frameRows = [];
        this.listType = listType;

        if(this.listType === Constants.MenuSettingsListType.POWER_OPTIONS)
            this.settingString = 'power-options';
        else if(this.listType === Constants.MenuSettingsListType.EXTRA_CATEGORIES)
            this.settingString = 'extra-categories';
        else if(this.listType === Constants.MenuSettingsListType.QUICK_LINKS)
            this.settingString = 'arcmenu-extra-categories-links';

        this._settings = settings;
        this.categoriesFrame = new Adw.PreferencesGroup();

        this._createFrame(this._settings.get_value(this.settingString).deep_unpack());
        this.append(this.categoriesFrame);

        this.restoreDefaults = () => {
            this.frameRows.forEach(child => {
                this.categoriesFrame.remove(child);
            });
            this.frameRows = [];

            this._createFrame(this._settings.get_default_value(this.settingString).deep_unpack());
            this.saveSettings();
        };
    }

    saveSettings(){
        let array = [];
        this.frameRows.sort((a, b) => {
            return a.get_index() > b.get_index();
        })
        this.frameRows.forEach(child => {
            array.push([child._enum, child._shouldShow]);
        });

        this._settings.set_value(this.settingString, new GLib.Variant('a(ib)', array));
    }

    _createFrame(extraCategories){
        for(let i = 0; i < extraCategories.length; i++){
            let categoryEnum = extraCategories[i][0];
            let name, iconString;
            if(this.listType === Constants.MenuSettingsListType.POWER_OPTIONS){
                name = Constants.PowerOptions[categoryEnum].NAME;
                iconString = Constants.PowerOptions[categoryEnum].ICON;
            }
            else {
                name = Constants.Categories[categoryEnum].NAME;
                iconString = Constants.Categories[categoryEnum].ICON
            }

            let frameRow = new PW.DragRow();
            frameRow._enum = extraCategories[i][0];
            frameRow._shouldShow = extraCategories[i][1];
            frameRow._name = _(name);
            //frameRow._gicon used in PW.DragRow
            frameRow._gicon = Gio.icon_new_for_string(iconString);
            frameRow.hasSwitch = true;
            frameRow.switchActive = frameRow._shouldShow;

            let applicationIcon = new Gtk.Image( {
                gicon: frameRow._gicon,
                pixel_size: 22
            });
            let dragImage = new Gtk.Image( {
                gicon: Gio.icon_new_for_string("drag-symbolic"),
                pixel_size: 12
            });
            frameRow.add_prefix(applicationIcon);
            frameRow.add_prefix(dragImage);
            frameRow.title = _(name);

            let buttonBox = new PW.EditEntriesBox({
                frameRow: frameRow,
                frame: this.categoriesFrame
            });

            let modifyButton = new Gtk.Switch({
                valign: Gtk.Align.CENTER,
                margin_start: 10,
            });

            frameRow.activatable_widget = modifyButton;
            modifyButton.set_active(frameRow._shouldShow);
            modifyButton.connect('notify::active', ()=> {
                frameRow._shouldShow = modifyButton.get_active();
                this.saveSettings();
            });
            buttonBox.connect("row-changed", () =>{
                this.saveSettings();
            });
            frameRow.connect("drag-drop-done", () => {
                this.saveSettings();
            });
            buttonBox.insert_column(0);
            buttonBox.attach(Gtk.Separator.new(Gtk.Orientation.VERTICAL), 0, 0, 1, 1);
            buttonBox.insert_column(0);
            buttonBox.attach(modifyButton, 0, 0, 1, 1);

            frameRow.add_suffix(buttonBox);
            this.frameRows.push(frameRow);
            this.categoriesFrame.add(frameRow);
        }
    }
});

var MiscPage = GObject.registerClass(
    class ArcMenu_MiscPage extends Adw.PreferencesPage {
        _init(settings, preferencesWindow) {
            super._init({
                title: _('Misc'),
                icon_name: 'misc-symbolic',
                name: "MiscPage"
            });
            this._settings = settings;

            let importFrame = new Adw.PreferencesGroup({
                title: _('Export or Import Settings')
            });
            let importRow = new Adw.ActionRow({
                title: _("ArcMenu Settings")
            });
            let settingsImportInfoButton = new PW.Button({
                icon_name: 'help-about-symbolic'
            });
            settingsImportInfoButton.connect('clicked', ()=> {
                let dialog = new Gtk.MessageDialog({
                    text: "<b>" + _("Export or Import ArcMenu Settings") + '</b>',
                    secondary_text:_('Importing will overwrite current settings.'),
                    use_markup: true,
                    buttons: Gtk.ButtonsType.OK,
                    message_type: Gtk.MessageType.WARNING,
                    transient_for: this.get_root(),
                    modal: true
                });
                dialog.connect('response', (widget, response) => {
                    dialog.destroy();
                });
                dialog.show();
            });

            let importButton = new Gtk.Button({
                label: _("Import"),
                valign: Gtk.Align.CENTER
            });
            importButton.connect('clicked', ()=> {
                this._showFileChooser(
                    _('Import settings'),
                    { action: Gtk.FileChooserAction.OPEN },
                    "_Open",
                    filename => {
                        if (filename && GLib.file_test(filename, GLib.FileTest.EXISTS)) {
                            let settingsFile = Gio.File.new_for_path(filename);
                            let [ success_, pid, stdin, stdout, stderr] =
                                GLib.spawn_async_with_pipes(
                                    null,
                                    ['dconf', 'load', SCHEMA_PATH],
                                    null,
                                    GLib.SpawnFlags.SEARCH_PATH | GLib.SpawnFlags.DO_NOT_REAP_CHILD,
                                    null
                                );

                            stdin = new Gio.UnixOutputStream({ fd: stdin, close_fd: true });
                            GLib.close(stdout);
                            GLib.close(stderr);

                            stdin.splice(settingsFile.read(null), Gio.OutputStreamSpliceFlags.CLOSE_SOURCE | Gio.OutputStreamSpliceFlags.CLOSE_TARGET, null);

                            populateWindow(preferencesWindow, this._settings);
                        }
                    }
                );
            });
            let exportButton = new Gtk.Button({
                label: _("Export"),
                valign: Gtk.Align.CENTER
            });
            exportButton.connect('clicked', ()=> {
                this._showFileChooser(
                    _('Export settings'),
                    { action: Gtk.FileChooserAction.SAVE},
                    "_Save",
                    (filename) => {
                        let file = Gio.file_new_for_path(filename);
                        let raw = file.replace(null, false, Gio.FileCreateFlags.NONE, null);
                        let out = Gio.BufferedOutputStream.new_sized(raw, 4096);
                        out.write_all(GLib.spawn_command_line_sync('dconf dump ' + SCHEMA_PATH)[1], null);
                        out.close(null);
                    }
                );
            });
            importRow.add_suffix(importButton);
            importRow.add_suffix(exportButton);
            importRow.add_suffix(settingsImportInfoButton);
            importFrame.add(importRow);
            this.add(importFrame);

            let settingsSizeFrame = new Adw.PreferencesGroup({
                title: _('ArcMenu Settings Window Size')
            });
            let settingsWidthScale = new Gtk.SpinButton({
                adjustment: new Gtk.Adjustment({
                    lower: 500, upper: 1800, step_increment: 1, page_increment: 1, page_size: 0,
                }),
                climb_rate: 1,
                digits: 0,
                numeric: true,
                valign: Gtk.Align.CENTER
            });
            settingsWidthScale.set_value(this._settings.get_int("settings-width"));
            settingsWidthScale.connect('value-changed', (widget) => {
                this._settings.set_int("settings-width", widget.get_value());
            });
            let settingsWidthRow = new Adw.ActionRow({
                title: _('Window Width'),
                activatable_widget: settingsWidthScale
            });
            settingsWidthRow.add_suffix(settingsWidthScale);
            settingsSizeFrame.add(settingsWidthRow);

            let settingsHeightScale = new Gtk.SpinButton({
                adjustment: new Gtk.Adjustment({
                    lower: 300, upper: 1600, step_increment: 1, page_increment: 1, page_size: 0,
                }),
                climb_rate: 1,
                digits: 0,
                numeric: true,
                valign: Gtk.Align.CENTER
            });
            settingsHeightScale.set_value(this._settings.get_int("settings-height"));
            settingsHeightScale.connect('value-changed', (widget) => {
                this._settings.set_int("settings-height", widget.get_value());
            });
            let settingsHeightRow = new Adw.ActionRow({
                title: _('Window Height'),
                activatable_widget: settingsHeightScale
            });
            settingsHeightRow.add_suffix(settingsHeightScale);
            settingsSizeFrame.add(settingsHeightRow);

            this.add(settingsSizeFrame);

            let buttonGroup = new Adw.PreferencesGroup({
                title: _("Reset all ArcMenu Settings")
            });
            let resetSettingsButton = new Gtk.Button({
                halign: Gtk.Align.START,
                valign: Gtk.Align.CENTER,
                hexpand: false,
                label: _("Reset all Settings"),
            });
            let context = resetSettingsButton.get_style_context();
            context.add_class('destructive-action');
            resetSettingsButton.connect('clicked', (widget) => {
                let dialog = new Gtk.MessageDialog({
                    text: "<b>" + _("Reset all settings?") + '</b>',
                    secondary_text: _("All ArcMenu settings will be reset to the default value."),
                    use_markup: true,
                    buttons: Gtk.ButtonsType.YES_NO,
                    message_type: Gtk.MessageType.WARNING,
                    transient_for: this.get_root(),
                    modal: true
                });
                dialog.connect('response', (widget, response) => {
                    if(response == Gtk.ResponseType.YES){
                        GLib.spawn_command_line_sync('dconf reset -f /org/gnome/shell/extensions/arcmenu/');
                        populateWindow(preferencesWindow, this._settings);
                    }
                    dialog.destroy();
                });
                dialog.show();
            });
            buttonGroup.add(resetSettingsButton);
            this.add(buttonGroup);
        }
        _showFileChooser(title, params, acceptBtn, acceptHandler) {
            let dialog = new Gtk.FileChooserDialog({
                title: _(title),
                transient_for: this.get_root(),
                modal: true,
                action: params.action,
            });
            dialog.add_button("_Cancel", Gtk.ResponseType.CANCEL);
            dialog.add_button(acceptBtn, Gtk.ResponseType.ACCEPT);

            dialog.connect("response", (self, response) => {
                if(response === Gtk.ResponseType.ACCEPT){
                    try {
                        acceptHandler(dialog.get_file().get_path());
                    } catch(e) {
                        log('error from ArcMenu filechooser: ' + e);
                    }
                }
                dialog.destroy();
            });

            dialog.show();
        }
});

var AboutPage = GObject.registerClass(
    class ArcMenu_AboutPage extends Adw.PreferencesPage {
        _init(settings) {
            super._init({
                title: _("About"),
                icon_name: 'help-about-symbolic',
                name: 'AboutPage'
            });
            this._settings = settings;

            //ArcMenu Logo and project description-------------------------------------
            let arcMenuLogoGroup = new Adw.PreferencesGroup();
            let arcMenuImage = new Gtk.Image({
                margin_bottom: 5,
                icon_name: 'arc-menu-logo',
                pixel_size: 100,
            });
            let arcMenuImageBox = new Gtk.Box( {
                orientation: Gtk.Orientation.VERTICAL,
                hexpand: false,
                vexpand: false
            });
            arcMenuImageBox.append(arcMenuImage);

            let arcMenuLabel = new Gtk.Label({
                label: '<span size="large"><b>' + _('ArcMenu') + '</b></span>',
                use_markup: true,
                vexpand: true,
                valign: Gtk.Align.FILL
            });

            let projectDescriptionLabel = new Gtk.Label({
                label: _('Application Menu Extension for GNOME'),
                hexpand: false,
                vexpand: false,
            });
            arcMenuImageBox.append(arcMenuLabel);
            arcMenuImageBox.append(projectDescriptionLabel);
            arcMenuLogoGroup.add(arcMenuImageBox);

            this.add(arcMenuLogoGroup);
            //-----------------------------------------------------------------------

            //Extension/OS Info Group------------------------------------------------
            let extensionInfoGroup = new Adw.PreferencesGroup();
            let arcMenuVersionRow = new Adw.ActionRow({
                title: _("ArcMenu Version"),
            });
            let releaseVersion;
            if(Me.metadata.version)
                releaseVersion = Me.metadata.version;
            else
                releaseVersion = 'unknown';
            arcMenuVersionRow.add_suffix(new Gtk.Label({
                label: releaseVersion + ''
            }));
            extensionInfoGroup.add(arcMenuVersionRow);

            let commitRow = new Adw.ActionRow({
                title: _('Git Commit')
            });
            let commitVersion;
            if(Me.metadata.commit)
                commitVersion = Me.metadata.commit;
            commitRow.add_suffix(new Gtk.Label({
                label: commitVersion ? commitVersion : '',
            }));
            if(commitVersion){
                extensionInfoGroup.add(commitRow);
            }

            let gnomeVersionRow = new Adw.ActionRow({
                title: _('GNOME Version'),
            });
            gnomeVersionRow.add_suffix(new Gtk.Label({
                label: imports.misc.config.PACKAGE_VERSION + '',
            }));
            extensionInfoGroup.add(gnomeVersionRow);

            let osRow = new Adw.ActionRow({
                title: _('OS'),
            });
            let osInfoText;
            let name = GLib.get_os_info("NAME");
            let prettyName = GLib.get_os_info("PRETTY_NAME");
            if(prettyName)
                osInfoText = prettyName;
            else
                osInfoText = name;
            let versionID = GLib.get_os_info("VERSION_ID");
            if(versionID)
                osInfoText += "; Version ID: " + versionID;
            let buildID = GLib.get_os_info("BUILD_ID");
            if(buildID)
                osInfoText += "; " + "Build ID: " +buildID;
            osRow.add_suffix(new Gtk.Label({
                label: osInfoText,
                single_line_mode: false,
                wrap: true,
            }));
            extensionInfoGroup.add(osRow);

            let sessionTypeRow = new Adw.ActionRow({
                title: _('Session Type'),
            });
            let windowingLabel;
            if(Me.metadata.isWayland)
                windowingLabel = "Wayland";
            else
                windowingLabel = "X11";
            sessionTypeRow.add_suffix(new Gtk.Label({
                label: windowingLabel,
            }));
            extensionInfoGroup.add(sessionTypeRow);

            this.add(extensionInfoGroup);
            //-----------------------------------------------------------------------

            //CREDTIS----------------------------------------------------------------
            let creditsGroup = new Adw.PreferencesGroup({
                title: _("Credits")
            });
            this.add(creditsGroup);

            let creditsRow = new Adw.PreferencesRow({
                activatable: false,
                selectable: false
            });
            creditsGroup.add(creditsRow);

            let creditsBox = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
            });
            creditsRow.set_child(creditsBox);

            let creditsCarousel = new Adw.Carousel({
                hexpand: true,
                halign: Gtk.Align.FILL,
                margin_top: 5,
                margin_bottom: 5
            });
            let creditsCarouselDots = new Adw.CarouselIndicatorDots({
                carousel: creditsCarousel,
            });
            creditsCarousel.append(new Gtk.Label({
                label: Constants.DEVELOPERS,
                use_markup: true,
                vexpand: true,
                valign: Gtk.Align.CENTER,
                hexpand: true,
                halign: Gtk.Align.FILL,
                justify: Gtk.Justification.CENTER
            }));
            creditsCarousel.append(new Gtk.Label({
                label: Constants.CONTRIBUTORS,
                use_markup: true,
                vexpand: true,
                valign: Gtk.Align.CENTER,
                hexpand: true,
                halign: Gtk.Align.FILL,
                justify: Gtk.Justification.CENTER
            }));
            creditsCarousel.append(new Gtk.Label({
                label: Constants.ARTWORK,
                use_markup: true,
                vexpand: true,
                valign: Gtk.Align.CENTER,
                hexpand: true,
                halign: Gtk.Align.FILL,
                justify: Gtk.Justification.CENTER
            }));
            creditsBox.append(creditsCarousel);
            creditsBox.append(creditsCarouselDots);
            //-----------------------------------------------------------------------

            let linksGroup = new Adw.PreferencesGroup();
            let linksBox = new Adw.ActionRow();

            let pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_scale(Me.path + '/media/icons/prefs_icons/donate-icon.svg', -1, 50, true);
            let donateImage = Gtk.Picture.new_for_pixbuf(pixbuf);
            let donateLinkButton = new Gtk.LinkButton({
                child: donateImage,
                uri: 'https://www.paypal.com/cgi-bin/webscr?cmd=_donations&business=53CWA7NR743WC&item_name=Donate+to+support+my+work&currency_code=USD&source=url',
            });

            pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_scale(Me.path + '/media/icons/prefs_icons/gitlab-icon.svg', -1, 50, true);
            let gitlabImage = Gtk.Picture.new_for_pixbuf(pixbuf);
            let projectUrl = Me.metadata.url;
            let projectLinkButton = new Gtk.LinkButton({
                child: gitlabImage,
                uri: projectUrl,
            });

            linksBox.add_prefix(projectLinkButton);
            linksBox.add_suffix(donateLinkButton);
            linksGroup.add(linksBox);
            this.add(linksGroup);

            let gnuSoftwareGroup = new Adw.PreferencesGroup();
            let gnuSofwareLabel = new Gtk.Label({
                label: _(Constants.GNU_SOFTWARE),
                use_markup: true,
                justify: Gtk.Justification.CENTER
            });
            let gnuSofwareLabelBox = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                valign: Gtk.Align.END,
                vexpand: true,
            });
            gnuSofwareLabelBox.append(gnuSofwareLabel);
            gnuSoftwareGroup.add(gnuSofwareLabelBox);
            this.add(gnuSoftwareGroup);
        }
});

var ThemePage = GObject.registerClass(
class ArcMenu_ThemePage extends Adw.PreferencesPage {
    _init(settings) {
        super._init({
            title: _("Theme"),
            icon_name: 'menu-theme-symbolic',
            name: 'ThemePage'
        });
        this._settings = settings;

        let overrideThemeGroup = new Adw.PreferencesGroup();
        this.add(overrideThemeGroup);

        let overrideThemeSwitch = new Gtk.Switch({
            valign: Gtk.Align.CENTER
        });
        overrideThemeSwitch.connect('notify::active', (widget) => {
            if(widget.get_active()){
                menuThemesGroup.show();
                menuGroup.show();
                menuItemsGroup.show();
            }
            else{
                menuThemesGroup.hide();
                menuGroup.hide();
                menuItemsGroup.hide();
            }
            this._settings.set_boolean('override-menu-theme', widget.get_active());
        });
        let overrideThemeRow = new Adw.ActionRow({
            title: _("Override Theme"),
            subtitle: _("Results may vary with third party themes"),
            activatable_widget: overrideThemeSwitch
        });
        overrideThemeRow.add_suffix(overrideThemeSwitch);
        overrideThemeGroup.add(overrideThemeRow);

        let menuThemesGroup = new Adw.PreferencesGroup({
            title: _("Menu Themes")
        });
        this.add(menuThemesGroup);

        //Theme Combo Box Section----------
        let themeList = new Gtk.ListStore();
        themeList.set_column_types([GdkPixbuf.Pixbuf, GObject.TYPE_STRING]);
        this.createIconList(themeList);

        let themeComboBox = new Gtk.ComboBox({
            model: themeList,
            valign: Gtk.Align.CENTER
        });
        let renderer = new Gtk.CellRendererPixbuf({xpad: 5});
        themeComboBox.pack_start(renderer, false);
        themeComboBox.add_attribute(renderer, "pixbuf", 0);
        renderer = new Gtk.CellRendererText();
        themeComboBox.pack_start(renderer, true);
        themeComboBox.add_attribute(renderer, "text", 1);

        themeComboBox.connect('changed', (widget) => {
            const index = widget.get_active();
            if(index < 0)
                return;

            let menuThemes = this._settings.get_value('menu-themes').deep_unpack();

            menuBGColorRow.setColor(menuThemes[index][1]);
            menuFGColorRow.setColor(menuThemes[index][2]);
            menuBorderColorRow.setColor(menuThemes[index][3]);

            menuBorderWidthRow.setValue(menuThemes[index][4]);
            menuBorderRadiusRow.setValue(menuThemes[index][5]);
            menuFontSizeRow.setValue(menuThemes[index][6]);

            menuSeparatorColorRow.setColor(menuThemes[index][7]);
            itemHoverBGColorRow.setColor(menuThemes[index][8]);
            itemHoverFGColorRow.setColor(menuThemes[index][9]);
            itemActiveBGColorRow.setColor(menuThemes[index][10]);
            itemActiveFGColorRow.setColor(menuThemes[index][11]);

            this.checkIfThemeMatch();
        });
        let menuThemesRow = new Adw.ActionRow({
            title: _("Current Theme"),
            activatable_widget: themeComboBox
        });
        menuThemesGroup.add(menuThemesRow);
        //---------------------------------

        //Manage Themes Section------------
        let manageThemesButton = new Gtk.Button({
            icon_name: 'emblem-system-symbolic',
            valign: Gtk.Align.CENTER
        });
        manageThemesButton.connect("clicked" , () => {
            let manageThemesDialog = new ManageThemesDialogWindow(this._settings, this);
            manageThemesDialog.show();
            manageThemesDialog.connect('response', (_w, response) => {
                if(response === Gtk.ResponseType.APPLY){
                    themeList.clear();
                    this.createIconList(themeList);
                    this.checkIfThemeMatch();
                }
            });
        });
        menuThemesRow.add_suffix(manageThemesButton);
        menuThemesRow.add_suffix(themeComboBox);
        //---------------------------------

        //Save Theme Section---------------
        let menuThemeSaveButton = new Gtk.Button({
            label: _("Save as Theme"),
            valign: Gtk.Align.CENTER
        });
        let context = menuThemeSaveButton.get_style_context();
        context.add_class('suggested-action');

        menuThemeSaveButton.connect("clicked" , () => {
            let saveThemeDialog = new ColorThemeDialogWindow(this._settings, this);
            saveThemeDialog.show();
            saveThemeDialog.connect('response', (_w, response) => {
                if(response === Gtk.ResponseType.APPLY){
                    let menuThemes = this._settings.get_value('menu-themes').deep_unpack();
                    let currentSettingsArray = [saveThemeDialog.themeName, menuBGColorRow.getColor(), menuFGColorRow.getColor(), menuBorderColorRow.getColor(), menuBorderWidthRow.getValue().toString(),
                                                menuBorderRadiusRow.getValue().toString(), menuFontSizeRow.getValue().toString(), menuSeparatorColorRow.getColor(), itemHoverBGColorRow.getColor(),
                                                itemHoverFGColorRow.getColor(), itemActiveBGColorRow.getColor(), itemActiveFGColorRow.getColor()];
                    menuThemes.push(currentSettingsArray);
                    this._settings.set_value('menu-themes', new GLib.Variant('aas', menuThemes));

                    themeList.clear();
                    this.createIconList(themeList);
                    this.checkIfThemeMatch();

                    saveThemeDialog.destroy();
                }
            });
        });
        //---------------------------------

        let menuGroup = new Adw.PreferencesGroup({
            title: _("Menu Styling"),
            header_suffix: menuThemeSaveButton
        });
        this.add(menuGroup);

        let menuBGColorRow = this._createColorRow(_("Background Color"), 'menu-background-color');
        menuGroup.add(menuBGColorRow);

        let menuFGColorRow = this._createColorRow(_("Foreground Color"), 'menu-foreground-color');
        menuGroup.add(menuFGColorRow);

        let menuBorderColorRow = this._createColorRow(_("Border Color"), 'menu-border-color');
        menuGroup.add(menuBorderColorRow);

        let menuBorderWidthRow = this._createSpinButtonRow(_("Border Width"), 'menu-border-width', 0, 5);
        menuGroup.add(menuBorderWidthRow);

        let menuBorderRadiusRow = this._createSpinButtonRow(_("Border Radius"), 'menu-border-radius', 0, 25);
        menuGroup.add(menuBorderRadiusRow);

        let menuFontSizeRow = this._createSpinButtonRow(_("Font Size"), 'menu-font-size', 8, 18);
        menuGroup.add(menuFontSizeRow);

        let menuSeparatorColorRow = this._createColorRow(_("Separator Color"), 'menu-separator-color');
        menuGroup.add(menuSeparatorColorRow);

        let menuItemsGroup = new Adw.PreferencesGroup({
            title: _("Menu Items Styling")
        });
        this.add(menuItemsGroup);

        let itemHoverBGColorRow = this._createColorRow(_("Hover") + " " + _("Background Color"), 'menu-item-hover-bg-color');
        menuItemsGroup.add(itemHoverBGColorRow);

        let itemHoverFGColorRow = this._createColorRow(_("Hover") + " " + _("Foreground Color"), 'menu-item-hover-fg-color');
        menuItemsGroup.add(itemHoverFGColorRow);

        let itemActiveBGColorRow = this._createColorRow(_("Active") + " " + _("Background Color"), 'menu-item-active-bg-color');
        menuItemsGroup.add(itemActiveBGColorRow);

        let itemActiveFGColorRow = this._createColorRow(_("Active") + " " + _("Foreground Color"), 'menu-item-active-fg-color');
        menuItemsGroup.add(itemActiveFGColorRow);

        let overrideMenuTheme = this._settings.get_boolean('override-menu-theme');
        overrideThemeSwitch.set_active(overrideMenuTheme);
        if(!overrideMenuTheme){
            menuThemesGroup.hide();
            menuGroup.hide();
            menuItemsGroup.hide();
        }

        this.checkIfThemeMatch = () => {
            let currentSettingsArray = ['', menuBGColorRow.getColor(), menuFGColorRow.getColor(), menuBorderColorRow.getColor(), menuBorderWidthRow.getValue().toString(),
                                        menuBorderRadiusRow.getValue().toString(), menuFontSizeRow.getValue().toString(), menuSeparatorColorRow.getColor(), itemHoverBGColorRow.getColor(),
                                        itemHoverFGColorRow.getColor(), itemActiveBGColorRow.getColor(), itemActiveFGColorRow.getColor()];

            let menuThemes = this._settings.get_value('menu-themes').deep_unpack();
            let index = 0;
            let matchFound = false;
            for(let theme of menuThemes){
                for(let i = 1; i < currentSettingsArray.length - 1; i++){
                    if(currentSettingsArray[i] !== theme[i]){
                        matchFound = false;
                        break;
                    }
                    matchFound = true;
                }

                if(matchFound){
                    themeComboBox.set_active(index);
                    menuThemeSaveButton.set_sensitive(false);
                    break;
                }
                index ++;
            }
            if(!matchFound){
                menuThemeSaveButton.set_sensitive(true);
                themeComboBox.set_active(-1);
            }
        }

        this.checkIfThemeMatch();
    }

    createIconList(store){
        let menuThemes = this._settings.get_value('menu-themes').deep_unpack();
        for(let theme of menuThemes){
            let xpm = createXpmImage(theme[1], theme[2], theme[3], theme[8]);
            let pixbuf = GdkPixbuf.Pixbuf.new_from_xpm_data(xpm);

            store.set(store.append(), [0, 1], [pixbuf, theme[0]]);
        }
    }

    _createColorRow(title, setting){
        let colorButton = new Gtk.ColorButton({
            use_alpha: true,
            valign: Gtk.Align.CENTER,
            rgba: parseRGBA(this._settings.get_string(setting))
        });
        colorButton.connect('notify::rgba', (widget) => {
            let colorString = widget.get_rgba().to_string();
            this._settings.set_string(setting, colorString);
            this.checkIfThemeMatch();
        });
        let colorRow = new Adw.ActionRow({
            title: _(title),
            activatable_widget: colorButton,
        });
        colorRow.add_suffix(colorButton);
        colorRow.setColor = (color) => {
            colorButton.set_rgba(parseRGBA(color));
        };
        colorRow.getColor = () => {
            return colorButton.get_rgba().to_string();
        }
        return colorRow;
    }

    _createSpinButtonRow(title, setting, lower, upper){
        let spinButton = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({
                lower,
                upper,
                step_increment: 1
            }),
            climb_rate: 1,
            digits: 0,
            numeric: true,
            valign: Gtk.Align.CENTER,
            value: this._settings.get_int(setting)
        });
        spinButton.connect('notify::value', (widget) => {
            this.checkIfThemeMatch();
            this._settings.set_int(setting, widget.get_value());
        });

        let spinRow = new Adw.ActionRow({
            title: _(title),
            activatable_widget: spinButton,
        });
        spinRow.add_suffix(spinButton);
        spinRow.setValue = (value) => {
            spinButton.set_value(value);
        };
        spinRow.getValue = () => {
            return spinButton.get_value();
        }
        return spinRow;
    }
});

var ColorThemeDialogWindow = GObject.registerClass(
class ArcMenu_ColorThemeDialogWindow extends PW.DialogWindow {
    _init(settings, parent, themeName) {
        super._init(_('Save Theme As...'), parent, Constants.MenuItemLocation.BOTTOM);
        this._settings = settings;
        this.themeName = themeName;
        this.search_enabled = false;
        this.set_default_size(550, 220);

        let themeNameEntry = new Gtk.Entry({
            valign: Gtk.Align.CENTER,
            width_chars: 35
        });
        let themeNameRow = new Adw.ActionRow({
            title: _("Theme Name"),
            activatable_widget: themeNameEntry,
        });
        themeNameRow.add_suffix(themeNameEntry);
        this.pageGroup.add(themeNameRow);

        if(this.themeName)
            themeNameEntry.set_text(this.themeName);

        themeNameEntry.connect('changed',() => {
            if(themeNameEntry.get_text().length > 0)
                saveButton.set_sensitive(true);
            else
                saveButton.set_sensitive(false);
        });

        let saveButton = new Gtk.Button({
            label: _("Save Theme"),
            sensitive: false,
            halign: Gtk.Align.END
        });

        let context = saveButton.get_style_context();
        context.add_class('suggested-action');

        saveButton.connect('clicked', ()=> {
            this.themeName = themeNameEntry.get_text();
            this.emit('response', Gtk.ResponseType.APPLY);
        });
        this.headerGroup.add(saveButton);
    }
});

var ManageThemesDialogWindow = GObject.registerClass(
class ArcMenu_ManageThemesDialogWindow extends PW.DialogWindow {
    _init(settings, parent) {
        super._init(_('Manage Themes'), parent);
        this._settings = settings;
        this.frameRows = [];

        let menuThemes = this._settings.get_value('menu-themes').deep_unpack();
        for(let i = 0; i < menuThemes.length; i++) {
            let theme = menuThemes[i];

            let themeRow = new PW.DragRow({
                title: theme[0]
            });
            themeRow.theme = theme;

            let xpm = createXpmImage(theme[1], theme[2], theme[3], theme[8]);
            let themePreviewImage = new Gtk.Image({
                hexpand: false,
                margin_end: 5,
                pixel_size: 42
            });
            themePreviewImage.set_from_pixbuf(GdkPixbuf.Pixbuf.new_from_xpm_data(xpm));

            themeRow._gicon = xpm;
            themeRow._name = theme[0];

            let dragImage = new Gtk.Image( {
                gicon: Gio.icon_new_for_string("drag-symbolic"),
                pixel_size: 12
            });
            themeRow.add_prefix(themePreviewImage);
            themeRow.add_prefix(dragImage);
            this.pageGroup.add(themeRow);

            let buttonBox = new PW.EditEntriesBox({
                frameRow: themeRow,
                modifyButton: true,
                deleteButton: true
            });
            themeRow.activatable_widget = buttonBox.editButton;
            buttonBox.connect('modify', () => {
                let dialog = new ColorThemeDialogWindow(this._settings, this, theme[0]);
                dialog.show();
                dialog.connect('response', (_w, response) => {
                    if(response === Gtk.ResponseType.APPLY) {
                        theme.splice(0, 1, dialog.themeName);
                        themeRow.title = dialog.themeName;
                        themeRow.theme = theme;
                        this.saveSettings();
                        dialog.destroy();
                    }
                });
            });

            buttonBox.connect("row-changed", () =>{
                this.saveSettings();
            });
            buttonBox.connect("row-deleted", () =>{
                this.frameRows.splice(this.frameRows.indexOf(themeRow), 1);
                this.saveSettings();
            });
            themeRow.connect("drag-drop-done", () => {
                this.saveSettings();
            });

            themeRow.add_suffix(buttonBox);
            this.frameRows.push(themeRow);
        }
    }

    saveSettings(){
        let array = [];

        this.frameRows.sort((a, b) => {
            return a.get_index() > b.get_index();
        });

        this.frameRows.forEach(child => {
            array.push(child.theme);
        });

        this._settings.set_value('menu-themes', new GLib.Variant('aas', array));
        this.emit('response', Gtk.ResponseType.APPLY);
    }
});


var BuildMenuSettingsPages = GObject.registerClass(
class ArcMenu_BuildMenuSettingsPages extends Adw.PreferencesPage {
    _init() {
        super._init({
            title: _('Customize'),
            icon_name: 'menu-settings-symbolic',
            name: 'MenuSettingsPage'
        });
        this._settings = ExtensionUtils.getSettings(Me.metadata['settings-schema']);
        this.mainGroup = new Adw.PreferencesGroup();
        this.add(this.mainGroup);

        this.settingsLeaflet = new Adw.Leaflet({
            homogeneous: true,
            transition_type: Adw.LeafletTransitionType.SLIDE,
            can_navigate_back: true,
            can_navigate_forward: true,
            can_unfold: true,
        });

        this.headerLabel = new Gtk.Label({
            label: "<b>" + _("Menu Settings") + "</b>",
            use_markup: true,
            justify: Gtk.Justification.CENTER,
            hexpand: true,
            halign: Gtk.Align.CENTER
        });

        this.menuSettingsStackListBox = new PW.StackListBox(this);
        let context = this.menuSettingsStackListBox.get_style_context();
        context.add_class('navigation-sidebar');
        context.add_class('background');
        this.menuSettingsStackListBox.addRow("MenuSettingsGeneral", _("Menu Settings"), 'menu-settings-symbolic');
        this.menuSettingsStackListBox.addRow("ButtonSettings", _("Button Settings"), 'arc-menu-symbolic');
        this.menuSettingsStackListBox.addRow("MenuSettingsPinnedApps", _("Pinned Apps"), 'view-pin-symbolic');
        this.menuSettingsStackListBox.addRow("MenuSettingsShortcutDirectories", _("Directory Shortcuts"), 'folder-documents-symbolic');
        this.menuSettingsStackListBox.addRow("MenuSettingsShortcutApplications", _("Application Shortcuts"), 'preferences-desktop-apps-symbolic');
        this.menuSettingsStackListBox.addRow("MenuSettingsPowerOptions", _("Power Options"), 'gnome-power-manager-symbolic');
        this.menuSettingsStackListBox.addRow("MenuSettingsSearchOptions", _("Search Options"), 'preferences-system-search-symbolic');
        this.menuSettingsStackListBox.addRow("MenuSettingsCategories", _("Extra Categories"), 'view-list-symbolic');
        this.menuSettingsStackListBox.addRow("MenuSettingsFineTune", _("Fine-Tune"), 'fine-tune-symbolic');
        this.menuSettingsStackListBox.setSeparatorIndices([2, 5, 8]);

        this.populateSettingsLeaflet();

        this.settingsLeaflet.connect('notify::visible-child', () => {
            const visibleChild = this.settingsLeaflet.get_visible_child();
            const currentPage = this.settingsLeaflet.get_page(visibleChild);
            const pageName = currentPage.translatableName;
            this.headerLabel.label = "<b>" + _(pageName) + "</b>";
            this.menuSettingsStackListBox.selectRowByName(currentPage.name);
            let nextChild = this.settingsLeaflet.get_adjacent_child(Adw.NavigationDirection.FORWARD);
            goNextButton.sensitive = nextChild ? true : false;
            let previousChild = this.settingsLeaflet.get_adjacent_child(Adw.NavigationDirection.BACK);
            goPreviousButton.sensitive = previousChild ? true : false;
        });

        this.flap = new Adw.Flap({
            content: this.settingsLeaflet,
            flap: this.menuSettingsStackListBox,
            separator: Gtk.Separator.new(Gtk.Orientation.VERTICAL),
            fold_policy: Adw.FlapFoldPolicy.ALWAYS
        });

        this.menuSettingsStackListBox.connect('row-activated', () => {
            this.flap.reveal_flap = false;
        });

        let sidebarButton = new Gtk.ToggleButton({
            icon_name: 'sidebar-show-symbolic',
            vexpand: false,
            valign: Gtk.Align.CENTER
        });
        context = sidebarButton.get_style_context();
        context.add_class('suggested-action');
        sidebarButton.bind_property('active', this.flap, 'reveal-flap', GObject.BindingFlags.BIDIRECTIONAL);

        sidebarButton.connect('toggled', (widget) => {
            if(widget.active){
                sidebarButton.icon_name = 'sidebar-show-right-symbolic';
            }
            else{
                sidebarButton.icon_name = 'sidebar-show-symbolic';
            }
        });
        let headerBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            margin_bottom: 2,
            spacing: 6
        });

        let restoreDefaultsButton = new Gtk.Button({
            icon_name: 'view-refresh-symbolic',
            vexpand: false,
            valign: Gtk.Align.CENTER
        });
        context = restoreDefaultsButton.get_style_context();
        context.add_class('destructive-action');
        restoreDefaultsButton.connect("clicked", () => {
            const visibleChild = this.settingsLeaflet.get_visible_child()
            const currentPage = this.settingsLeaflet.get_page(visibleChild);
            const pageName = currentPage.translatableName;
            let dialog = new Gtk.MessageDialog({
                text: "<b>" + _("Reset all %s?").format(pageName) + '</b>',
                secondary_text: _("All %s will be reset to the default value.").format(pageName),
                use_markup: true,
                buttons: Gtk.ButtonsType.YES_NO,
                message_type: Gtk.MessageType.WARNING,
                transient_for: this.get_root(),
                modal: true
            });
            dialog.connect('response', (widget, response) => {
                if(response == Gtk.ResponseType.YES){
                    if(!visibleChild)
                        return;
                    if(visibleChild.restoreDefaults)
                        visibleChild.restoreDefaults();
                }
                dialog.destroy();
            });
            dialog.show();
        });

        let goNextButton = new Gtk.Button({
            icon_name: 'go-next-symbolic',
            halign: Gtk.Align.END
        });
        context = goNextButton.get_style_context();
        context.add_class('osd');

        goNextButton.connect('clicked', (widget) => {
            this.settingsLeaflet.navigate(Adw.NavigationDirection.FORWARD);
        });
        let goPreviousButton = new Gtk.Button({
            icon_name: 'go-previous-symbolic',
            sensitive: false
        });
        context = goPreviousButton.get_style_context();
        context.add_class('osd');

        goPreviousButton.connect('clicked', (widget) => {
            this.settingsLeaflet.navigate(Adw.NavigationDirection.BACK);
        });

        headerBox.append(goPreviousButton);
        headerBox.append(sidebarButton);
        headerBox.append(this.headerLabel);
        headerBox.append(restoreDefaultsButton);
        headerBox.append(goNextButton);

        this.mainGroup.add(headerBox);
        this.mainGroup.add(this.flap);

        this.settingsLeaflet.set_visible_child_name("MenuSettingsGeneral");
        this.menuSettingsStackListBox.selectFirstRow();
    }

    populateSettingsLeaflet(){
        let leafletPage = this.settingsLeaflet.append(new MenuSettingsGeneralPage(this._settings));
        leafletPage.name = "MenuSettingsGeneral";
        leafletPage.translatableName = _("Menu Settings");

        leafletPage = this.settingsLeaflet.append(new ButtonAppearancePage(this._settings));
        leafletPage.name = "ButtonSettings";
        leafletPage.translatableName = _("Button Settings");

        leafletPage = this.settingsLeaflet.append(new MenuSettingsListPage(this._settings, Constants.MenuSettingsListType.PINNED_APPS));
        leafletPage.name = "MenuSettingsPinnedApps";
        leafletPage.translatableName = _("Pinned Apps");

        let pinnedPage = this.settingsLeaflet.get_child_by_name("MenuSettingsPinnedApps");

        if(this.pinnedAppsChangedID){
            this._settings.disconnect(this.pinnedAppsChangedID);
            this.pinnedAppsChangedID = null;
        }
        this.pinnedAppsChangedID = this._settings.connect("changed::pinned-app-list", () =>{
            pinnedPage.frameRows.forEach(child => {
                pinnedPage.frame.remove(child);
            });

            pinnedPage.frameRows = [];
            pinnedPage._createFrame(this._settings.get_strv('pinned-app-list'));
        });

        leafletPage = this.settingsLeaflet.append(new MenuSettingsListPage(this._settings, Constants.MenuSettingsListType.DIRECTORIES));
        leafletPage.name = "MenuSettingsShortcutDirectories";
        leafletPage.translatableName = _("Directory Shortcuts");

        leafletPage = this.settingsLeaflet.append(new MenuSettingsListPage(this._settings, Constants.MenuSettingsListType.APPLICATIONS));
        leafletPage.name = "MenuSettingsShortcutApplications";
        leafletPage.translatableName = _("Application Shortcuts");

        leafletPage = this.settingsLeaflet.append(new MenuSettingsListOtherPage(this._settings, Constants.MenuSettingsListType.POWER_OPTIONS));
        leafletPage.name = "MenuSettingsPowerOptions";
        leafletPage.translatableName = _("Power Options");

        leafletPage = this.settingsLeaflet.append(new MenuSettingsSearchOptionsPage(this._settings));
        leafletPage.name = "MenuSettingsSearchOptions";
        leafletPage.translatableName = _("Search Options");

        leafletPage = this.settingsLeaflet.append(new MenuSettingsListOtherPage(this._settings, Constants.MenuSettingsListType.EXTRA_CATEGORIES));
        leafletPage.name = "MenuSettingsCategories";
        leafletPage.translatableName = _("Extra Categories");

        leafletPage = this.settingsLeaflet.append(new MenuSettingsFineTunePage(this._settings));
        leafletPage.name = "MenuSettingsFineTune";
        leafletPage.translatableName = _("Fine-Tune");
    }
});
function init() {
    ExtensionUtils.initTranslations(Me.metadata['gettext-domain']);
}

function populateWindow(window, settings){
    if(window.pages?.length > 0){
        window.pages.forEach(page => window.remove(page));
    }

    window.pages = [];

    const generalSettingPage = new GeneralPage(settings);
    window.add(generalSettingPage);
    window.pages.push(generalSettingPage);

    const menuLayoutsPage = new MenuLayoutPage(settings);
    window.add(menuLayoutsPage);
    window.pages.push(menuLayoutsPage);

    const themePage = new ThemePage(settings);
    window.add(themePage);
    window.pages.push(themePage);

    const menuSettingsPage = new BuildMenuSettingsPages();
    window.add(menuSettingsPage);
    window.pages.push(menuSettingsPage);

    const miscPage = new MiscPage(settings, window);
    window.add(miscPage);
    window.pages.push(miscPage);

    const aboutPage = new AboutPage(settings);
    window.add(aboutPage);
    window.pages.push(aboutPage);

    setVisiblePage(window, settings);
}

function setVisiblePage(window, settings){
    if(settings.get_int('prefs-visible-page') === Constants.PrefsVisiblePage.MAIN){
        window.set_visible_page_name("GeneralSettingPage");
    }
    else if(settings.get_int('prefs-visible-page') === Constants.PrefsVisiblePage.CUSTOMIZE_MENU){
        window.set_visible_page_name("MenuSettingsPage");
        let page = window.get_visible_page();
        page.menuSettingsStackListBox.selectRowByName("MenuSettingsGeneral");
    }
    else if(settings.get_int('prefs-visible-page') === Constants.PrefsVisiblePage.MENU_LAYOUT){
        window.set_visible_page_name("MenuLayoutsPage");
        let page = window.get_visible_page();
        page.displayLayouts();
    }
    else if(settings.get_int('prefs-visible-page') === Constants.PrefsVisiblePage.BUTTON_APPEARANCE){
        window.set_visible_page_name("MenuSettingsPage");
        let page = window.get_visible_page();
        page.menuSettingsStackListBox.selectRowByName("ButtonSettings");
    }
    else if(settings.get_int('prefs-visible-page') === Constants.PrefsVisiblePage.LAYOUT_TWEAKS){
        window.set_visible_page_name("MenuLayoutsPage");
        let page = window.get_visible_page();
        page.displayLayoutTweaksPage();
    }
    else if(settings.get_int('prefs-visible-page') === Constants.PrefsVisiblePage.RUNNER_TWEAKS){
        window.set_visible_page_name("MenuLayoutsPage");
        let page = window.get_visible_page();
        page.displayRunnerTweaksPage();
    }
    else if(settings.get_int('prefs-visible-page') === Constants.PrefsVisiblePage.ABOUT){
        window.set_visible_page_name("AboutPage");
    }
    else if(settings.get_int('prefs-visible-page') === Constants.PrefsVisiblePage.GENERAL){
        window.set_visible_page_name("GeneralSettingPage");
    }
    else if(settings.get_int('prefs-visible-page') === Constants.PrefsVisiblePage.MENU_THEME){
        window.set_visible_page_name("ThemePage");
    }
    settings.set_int('prefs-visible-page', Constants.PrefsVisiblePage.MAIN);
}

function fillPreferencesWindow(window) {
    let preferences = new Preferences(window);
    window.connect('close-request', () => preferences.destroy());
}

const Preferences = class {
    constructor(window) {
        this._settings = ExtensionUtils.getSettings();

        let iconTheme = Gtk.IconTheme.get_for_display(Gdk.Display.get_default());
        if(!iconTheme.get_search_path().includes(Me.path + "/media/icons/prefs_icons"))
            iconTheme.add_search_path(Me.path + "/media/icons/prefs_icons");
    
        window.set_search_enabled(true);

        this.pageChangedId = this._settings.connect("changed::prefs-visible-page", () => {
            if(this._settings.get_int('prefs-visible-page') !== Constants.PrefsVisiblePage.MAIN){
                setVisiblePage(window, this._settings);
            }
        });
    
        window.default_width = this._settings.get_int('settings-width');
        window.default_height = this._settings.get_int('settings-height');
        window.set_title(_("ArcMenu Settings"));
    
        populateWindow(window, this._settings);
    }

    destroy(){
        if (this.pageChangedId) {
            this._settings.disconnect(this.pageChangedId);
            this.pageChangedId = null;
        }
    }
}

function checkIfValidShortcut(frameRow, icon){
    if(frameRow._cmd.endsWith(".desktop") && !Gio.DesktopAppInfo.new(frameRow._cmd)){
        icon.icon_name = 'warning-symbolic';
        frameRow.title = "<b><i>" + _("Invalid Shortcut") + "</i></b> "+ _(frameRow.title);
    }
}

function parseRGBA(colorString){
    let rgba = new Gdk.RGBA();
    rgba.parse(colorString);
    return rgba;
}

function createXpmImage(color1, color2, color3, color4){
    color1 = rgbToHex(parseRGBA(color1));
    color2 = rgbToHex(parseRGBA(color2));
    color3 = rgbToHex(parseRGBA(color3));
    color4 = rgbToHex(parseRGBA(color4));
    let width = 42;
    let height = 14;
    let nColors = 5;

    let xpmData = [`${width} ${height} ${nColors} 1`, `1 c ${color1}`, `2 c ${color2}`,
                    `3 c ${color3}`, `4 c ${color4}`, `x c #AAAAAA`]

    xpmData.push("xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx");

    for(let i = 0; i < height - 2; i++)
        xpmData.push("x1111111111222222222233333333334444444444x");

    xpmData.push("xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx");

    return xpmData;
}

function rgbToHex(color) {
    let [r, g, b, a_] = [Math.round(color.red * 255), Math.round(color.green * 255), Math.round(color.blue * 255), Math.round(color.alpha * 255)];
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

function getIconPath(listing){
    let path, icon;
    const shortcutCommand = listing[2];
    const shortcutIconName = listing[1];

    if(shortcutCommand === "ArcMenu_Home")
        path = GLib.get_home_dir();
    else if(shortcutCommand.startsWith("ArcMenu_")){
        let string = shortcutCommand;
        path = string.replace("ArcMenu_",'');
        if(path === "Documents")
            path = GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_DOCUMENTS);
        else if(path === "Downloads")
            path = GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_DOWNLOAD);
        else if(path === "Music")
            path = GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_MUSIC);
        else if(path === "Pictures")
            path = GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_PICTURES);
        else if(path === "Videos")
            path = GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_VIDEOS);
        else
            path = null;
    }
    else if(shortcutIconName === shortcutCommand)
        path = shortcutIconName;
    else if(shortcutIconName === "ArcMenu_Folder"){
        path = shortcutIconName;
    }
    else
        path = null;

    if(path){
        let file = Gio.File.new_for_path(path);
        try {
            let info = file.query_info('standard::symbolic-icon', 0, null);
            icon = info.get_symbolic_icon();
        } catch (e) {
            if (e instanceof Gio.IOErrorEnum) {
                if (!file.is_native()) {
                    icon = new Gio.ThemedIcon({ name: 'folder-remote-symbolic' });
                } else {
                    icon = new Gio.ThemedIcon({ name: 'folder-symbolic' });
                }
            }
        }
        return icon.to_string();
    }
    else{
        if(shortcutCommand === "ArcMenu_Network")
            return 'network-workgroup-symbolic';
        else if(shortcutCommand === "ArcMenu_Computer")
            return 'drive-harddisk-symbolic';
        else
            return shortcutIconName;
    }
}

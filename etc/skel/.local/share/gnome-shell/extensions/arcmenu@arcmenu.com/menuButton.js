const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const {Clutter, GLib, GObject, Shell, St} = imports.gi;
const appSys = Shell.AppSystem.get_default();
const Constants = Me.imports.constants;
const { ExtensionState } = ExtensionUtils;
const Gettext = imports.gettext.domain(Me.metadata['gettext-domain']);
const Main = imports.ui.main;
const MW = Me.imports.menuWidgets;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Util = imports.misc.util;
const Utils = Me.imports.utils;
const _ = Gettext.gettext;

var DASH_TO_PANEL_UUID = 'dash-to-panel@jderose9.github.com';

var MenuButton = GObject.registerClass(class ArcMenu_MenuButton extends PanelMenu.Button{
    _init(settings, panel) {
        super._init(0.5, null, true);
        this._settings = settings;
        this._panel = panel;
        this.menu.destroy();
        this.menu = null;
        this.add_style_class_name('arcmenu-panel-menu');
        this.tooltipShowing = false;
        this.tooltipShowingID = null;

        this.tooltip = new MW.Tooltip(this);
        this.dtpNeedsRelease = false;

        //Create Main Menus - ArcMenu and arcMenu's context menu
        this.arcMenu = new ArcMenu(this, 0.5, St.Side.TOP);
        this.arcMenu.connect('open-state-changed', this._onOpenStateChanged.bind(this));

        this.arcMenuContextMenu = new ArcMenuContextMenu(this, 0.5, St.Side.TOP);
        this.arcMenuContextMenu.connect('open-state-changed', this._onOpenStateChanged.bind(this));

        this.arcMenuContextMenu.actor.add_style_class_name('app-menu');
        this.arcMenuContextMenu.actor.add_style_class_name('arcmenu-menu');

        this.arcMenu.actor.add_style_class_name('panel-menu');
        this.arcMenu.actor.add_style_class_name('arcmenu-menu');

        this.menuManager = new PopupMenu.PopupMenuManager(this._panel);
        this.menuManager._changeMenu = (menu) => {};
        this.menuManager.addMenu(this.arcMenu);
        this.menuManager.addMenu(this.arcMenuContextMenu);

        //Context Menus for applications and other menu items
        this.contextMenuManager = new PopupMenu.PopupMenuManager(this);
        this.contextMenuManager._changeMenu = (menu) => {};
        this.contextMenuManager._onMenuSourceEnter = (menu) =>{
            if (this.contextMenuManager.activeMenu && this.contextMenuManager.activeMenu != menu)
                return Clutter.EVENT_STOP;

            return Clutter.EVENT_PROPAGATE;
        }

        //Sub Menu Manager - Control all other popup menus
        this.subMenuManager = new PopupMenu.PopupMenuManager(this);
        this.subMenuManager._changeMenu = (menu) => {};

        this.menuButtonWidget = new MW.MenuButtonWidget();
        this.x_expand = false;
        this.y_expand = false;

        //Add Menu Button Widget to Button
        this.add_child(this.menuButtonWidget.actor);
    }

    initiate(){
        //Dash to Panel Integration
        this.dashToPanel = Main.extensionManager.lookup(DASH_TO_PANEL_UUID);
        this.extensionChangedId = Main.extensionManager.connect('extension-state-changed', (data, extension) => {
            if (extension.uuid === DASH_TO_PANEL_UUID) {
                if (extension.state === ExtensionState.ENABLED) {
                    this.dashToPanel = Main.extensionManager.lookup(DASH_TO_PANEL_UUID);
                    this.syncWithDashToPanel();
                }
                else if (extension.state === ExtensionState.DISABLED) {
                    this.dashToPanel = null;
                    this.arcMenuContextMenu.removeExtensionSettings();
                    this.updateArrowSide(St.Side.TOP);
                    if(this.dtpPostionChangedID>0 && this.extensionSettingsItem){
                        this.extensionSettingsItem.disconnect(this.dtpPostionChangedID);
                        this.dtpPostionChangedID = 0;
                    }
                }
            }
        });
        if(this.dashToPanel?.state === ExtensionState.ENABLED){
            this.syncWithDashToPanel();
        }

        this._monitorsChangedId = Main.layoutManager.connect('monitors-changed', () => {
            this.updateHeight();
        });

        this._startupCompleteId = Main.layoutManager.connect('startup-complete', () => {
            this.updateHeight();
        });

        this.setRecentApps();
        this.setMenuPositionAlignment();

        //Create Basic Layout
        this.createLayoutID = GLib.timeout_add(0, 100, () => {
            this.createMenuLayout();
            this.createLayoutID = null;
            return GLib.SOURCE_REMOVE;
        });
    }

    syncWithDashToPanel(){
        this.arcMenuContextMenu.addExtensionSettings();
        this.extensionSettingsItem = Utils.getSettings('org.gnome.shell.extensions.dash-to-panel', DASH_TO_PANEL_UUID);
        let monitorIndex = Main.layoutManager.findIndexForActor(this);
        let side = Utils.getDashToPanelPosition(this.extensionSettingsItem, monitorIndex);
        this.updateArrowSide(side);
        let dashToPanelPositionSettings = 'panel-positions'
        try{
            this.extensionSettingsItem.get_string(dashToPanelPositionSettings);
        } catch(e){
            dashToPanelPositionSettings = 'panel-position'
        }
        this.dtpPostionChangedID = this.extensionSettingsItem.connect('changed::' + dashToPanelPositionSettings, ()=> {
            let monitorIndex = Main.layoutManager.findIndexForActor(this);
            let side = Utils.getDashToPanelPosition(this.extensionSettingsItem, monitorIndex);
            this.updateArrowSide(side);
        });
        if(global.dashToPanel && global.dashToPanel.panels){
            global.dashToPanel.panels.forEach(p => {
                if(p.panel === this._panel){
                    this.dtpPanel = p;
                }
            });
        }
    }

    setRecentApps(){
        if(this._installedChangedId){
            appSys.disconnect(this._installedChangedId);
            this._installedChangedId = null;
        }

        if(this._settings.get_boolean('disable-recently-installed-apps'))
            return;

        this._appList = this.listAllApps();
        //Update Categories on 'installed-changed' event-------------------------------------
        this._installedChangedId = appSys.connect('installed-changed', () => {
            this._newAppList = this.listAllApps();

            //Filter to find if a new application has been installed
            let newApps = this._newAppList.filter(app => !this._appList.includes(app));

            //A New Application has been installed
            //Save it in settings
            if(newApps.length){
                let recentApps = this._settings.get_strv('recently-installed-apps');
                let newRecentApps = [...new Set(recentApps.concat(newApps))];
                this._settings.set_strv('recently-installed-apps', newRecentApps);
                this.MenuLayout.reloadApplications();
            }

            this._appList = this._newAppList;
        });
    }

    listAllApps(){
        let appList = appSys.get_installed().filter(appInfo => {
            try {
                appInfo.get_id(); // catch invalid file encodings
            } catch (e) {
                return false;
            }
            return appInfo.should_show();
        });
        return appList.map(app => app.get_id());
    }

    createMenuLayout(){
        if(this.tooltip)
            this.tooltip.sourceActor = null;
        this._menuInForcedLocation = false;
        this.arcMenu.removeAll();
        this.section = new PopupMenu.PopupMenuSection();
        this.arcMenu.addMenuItem(this.section);
        this.mainBox = new St.BoxLayout({
            reactive: true,
            vertical: false,
            x_expand: true,
            y_expand: true,
            x_align: Clutter.ActorAlign.FILL,
            y_align: Clutter.ActorAlign.FILL
        });
        this.mainBox._delegate = this.mainBox;
        this.section.actor.add_child(this.mainBox);

        this.MenuLayout = Utils.getMenuLayout(this, this._settings.get_enum('menu-layout'));
        this.setMenuPositionAlignment();
        this.forceMenuLocation();
        this.updateHeight();
    }

    reloadMenuLayout(){
        if(this.tooltip)
            this.tooltip.sourceActor = null;
        this._menuInForcedLocation = false;

        this.MenuLayout.destroy();
        this.MenuLayout = null;
        this.MenuLayout = Utils.getMenuLayout(this, this._settings.get_enum('menu-layout'));

        this.setMenuPositionAlignment();
        this.forceMenuLocation();
        this.updateHeight();
    }

    setMenuPositionAlignment(){
        let layout = this._settings.get_enum('menu-layout');

        let arrowAlignment = (this._settings.get_int('menu-position-alignment') / 100);
        if(layout != Constants.MenuLayout.RUNNER){
            if(this._settings.get_enum('position-in-panel') == Constants.MenuPosition.CENTER){
                this.arcMenuContextMenu._arrowAlignment = arrowAlignment
                this.arcMenu._arrowAlignment = arrowAlignment
                this.arcMenuContextMenu._boxPointer.setSourceAlignment(.5);
                this.arcMenu._boxPointer.setSourceAlignment(.5);
            }
            else if(this.dashToPanel?.state === ExtensionState.ENABLED){
                let monitorIndex = Main.layoutManager.findIndexForActor(this);
                let side = Utils.getDashToPanelPosition(this.extensionSettingsItem, monitorIndex);
                this.updateArrowSide(side, false);
            }
            else{
                this.updateArrowSide(St.Side.TOP, false);
            }
        }
        else{
            this.updateArrowSide(St.Side.TOP, false);
            if(this._settings.get_enum('position-in-panel') == Constants.MenuPosition.CENTER){
                this.arcMenuContextMenu._arrowAlignment = arrowAlignment
                this.arcMenuContextMenu._boxPointer.setSourceAlignment(.5);
            }
        }
    }

    updateArrowSide(side, setAlignment = true){
        let arrowAlignment;
        if(side === St.Side.RIGHT || side === St.Side.LEFT)
            arrowAlignment = 1.0;
        else
            arrowAlignment = 0.5;

        this.arcMenuContextMenu._arrowSide = side;
        this.arcMenuContextMenu._boxPointer._arrowSide = side;
        this.arcMenuContextMenu._boxPointer._userArrowSide = side;
        this.arcMenuContextMenu._boxPointer.setSourceAlignment(0.5);
        this.arcMenuContextMenu._arrowAlignment = arrowAlignment;
        this.arcMenuContextMenu._boxPointer._border.queue_repaint();

        this.arcMenu._arrowSide = side;
        this.arcMenu._boxPointer._arrowSide = side;
        this.arcMenu._boxPointer._userArrowSide = side;
        this.arcMenu._boxPointer.setSourceAlignment(0.5);
        this.arcMenu._arrowAlignment = arrowAlignment;
        this.arcMenu._boxPointer._border.queue_repaint();

        if(setAlignment)
            this.setMenuPositionAlignment();
    }

    forceMenuLocation(){
        let layout = this._settings.get_enum('menu-layout');
        let forcedMenuLocation = this._settings.get_enum('force-menu-location');
        if(layout === Constants.MenuLayout.RUNNER || layout === Constants.MenuLayout.RAVEN)
            return;

        if(forcedMenuLocation === Constants.ForcedMenuLocation.OFF){
            if(!this._menuInForcedLocation)
                return;
            this.arcMenu.sourceActor = this;
            this.arcMenu.focusActor = this;
            this.arcMenu._boxPointer.setPosition(this, 0.5);
            this.arcMenu.actor.style = null
            this.setMenuPositionAlignment();
            this._menuInForcedLocation = false;
            return;
        }

        if(!this.dummyWidget){
            this.dummyWidget = new St.Widget({ width: 0, height: 0, opacity: 0 });
            Main.uiGroup.add_child(this.dummyWidget);
        }

        if(!this._menuInForcedLocation){
            this.arcMenu.sourceActor = this.dummyWidget;
            this.arcMenu.focusActor = this.dummyWidget;
            this.arcMenu._boxPointer.setPosition(this.dummyWidget, 0.5);
            this.arcMenu._boxPointer.setSourceAlignment(0.5);
            this.arcMenu._arrowAlignment = 0.5;
            this._menuInForcedLocation = true;
        }

        let monitorIndex = Main.layoutManager.findIndexForActor(this);
        let rect = Main.layoutManager.getWorkAreaForMonitor(monitorIndex);

        //Position the runner menu in the center of the current monitor, at top of screen.
        let positionX = Math.round(rect.x + (rect.width / 2));
        let positionY;
        if(forcedMenuLocation === Constants.ForcedMenuLocation.TOP_CENTERED){
            this.updateArrowSide(St.Side.TOP);
            positionY = rect.y;
            this.arcMenu.actor.style = null;
        }

        else if(forcedMenuLocation === Constants.ForcedMenuLocation.BOTTOM_CENTERED){
            this.updateArrowSide(St.Side.BOTTOM);
            positionY = rect.y + rect.height;
            this.arcMenu.actor.style = 'margin-bottom: 0px;';
        }

        this.dummyWidget.set_position(positionX, positionY);
    }

    vfunc_event(event){
        if (event.type() === Clutter.EventType.BUTTON_PRESS){
            if(event.get_button() == 1){
                this.toggleMenu();
            }
            else if(event.get_button() == 3){
                this.arcMenuContextMenu.toggle();
            }
        }
        else if(event.type() === Clutter.EventType.TOUCH_BEGIN){
            this.toggleMenu();
        }
        return Clutter.EVENT_PROPAGATE;
    }

    toggleMenu(){
        if(this.contextMenuManager.activeMenu)
            this.contextMenuManager.activeMenu.toggle();
        if(this.subMenuManager.activeMenu)
            this.subMenuManager.activeMenu.toggle();

        this.forceMenuLocation();
        let layout = this._settings.get_enum('menu-layout');
        if(layout === Constants.MenuLayout.GNOME_OVERVIEW){
            if(this._settings.get_boolean('gnome-dash-show-applications')){
                Main.overview._overview._controls._toggleAppsPage();
            }
            else
                Main.overview.toggle();
        }
        else if(!this.arcMenu.isOpen){
            if(layout === Constants.MenuLayout.RUNNER || layout === Constants.MenuLayout.RAVEN)
                this.MenuLayout.updateLocation();
            if(this.dtpPanel){
                if(this.dtpPanel.intellihide?.enabled){
                    this.dtpPanel.intellihide._revealPanel(true);
                    this.dtpPanel.intellihide.revealAndHold(1);
                }
                else if(!this.dtpPanel.panelBox.visible){
                    this.dtpPanel.panelBox.visible = true;
                    this.dtpNeedsHiding = true;
                }
            }
            else if(this._panel === Main.panel && !Main.layoutManager.panelBox.visible){
                Main.layoutManager.panelBox.visible = true;
                this.mainPanelNeedsHiding = true;
            }

            this.arcMenu.toggle();
            if(this.arcMenu.isOpen && this.MenuLayout){
                this.mainBox.grab_key_focus();
            }
        }
        else if(this.arcMenu.isOpen){
            this.arcMenu.toggle();
        }
    }

    getActiveMenu(){
        if(this.contextMenuManager.activeMenu)
            return this.contextMenuManager.activeMenu;
        else if(this.subMenuManager.activeMenu)
            return this.subMenuManager.activeMenu;
        else if(this.arcMenu.isOpen)
            return this.arcMenu;
        else if(this.arcMenuContextMenu.isOpen)
            return this.arcMenuContextMenu;
        else
            return null;
    }

    toggleArcMenuContextMenu(){
        if(this.arcMenuContextMenu.isOpen)
            this.arcMenuContextMenu.toggle();
    }

    updateHeight(){
        let layout = this._settings.get_enum('menu-layout');

        let monitorIndex = Main.layoutManager.findIndexForActor(this);
        let scaleFactor = Main.layoutManager.monitors[monitorIndex].geometry_scale;
        let monitorWorkArea = Main.layoutManager.getWorkAreaForMonitor(monitorIndex);
        let height = Math.round(this._settings.get_int('menu-height') / scaleFactor);

        if(height > monitorWorkArea.height){
            height = (monitorWorkArea.height * 8) / 10;
        }

        if(layout !== Constants.MenuLayout.RUNNER && this.MenuLayout)
            this.mainBox.style = `height: ${height}px`;
    }

    updateWidth(){
        if(this.MenuLayout?.updateWidth)
            this.MenuLayout.updateWidth(true);
    }

    _onDestroy(){
        if (this._monitorsChangedId){
            Main.layoutManager.disconnect(this._monitorsChangedId);
            this._monitorsChangedId = null;
        }
        if (this._startupCompleteId){
            Main.layoutManager.disconnect(this._startupCompleteId);
            this._startupCompleteId = null;
        }
        if(this.createLayoutID){
            GLib.source_remove(this.createLayoutID);
            this.createLayoutID = null;
        }
        if(this.updateMenuLayoutID){
            GLib.source_remove(this.updateMenuLayoutID);
            this.updateMenuLayoutID = null;
        }
        if(this.tooltipShowingID){
            GLib.source_remove(this.tooltipShowingID);
            this.tooltipShowingID = null;
        }
        if(this.extensionChangedId){
            Main.extensionManager.disconnect(this.extensionChangedId);
            this.extensionChangedId = null;
        }
        if(this.dtpPostionChangedID && this.extensionSettingsItem){
            this.extensionSettingsItem.disconnect(this.dtpPostionChangedID);
            this.dtpPostionChangedID = null;
        }
        if(this._installedChangedId){
            appSys.disconnect(this._installedChangedId);
            this._installedChangedId = null;
        }
        if(this.tooltip){
            this.tooltip.destroy();
        }
        if(this.MenuLayout)
            this.MenuLayout.destroy();
        if(this.arcMenu)
            this.arcMenu.destroy();
        if(this.arcMenuContextMenu)
            this.arcMenuContextMenu.destroy();
        if(this.dummyWidget)
            this.dummyWidget.destroy();

        super._onDestroy();
    }

    updateMenuLayout(){
        this.tooltipShowing = false;
        if (this.tooltipShowingID) {
            GLib.source_remove(this.tooltipShowingID);
            this.tooltipShowingID = null;
        }
        if(this.MenuLayout){
            this.MenuLayout.destroy();
            this.MenuLayout = null;
        }
        this.updateMenuLayoutID = GLib.timeout_add(0, 100, () => {
            this.createMenuLayout();
            this.updateMenuLayoutID = null;
            return GLib.SOURCE_REMOVE;
        });
    }

    loadExtraPinnedApps(){
        if(this.MenuLayout)
            this.MenuLayout.loadExtraPinnedApps();
    }

    updateLocation(){
        if(this.MenuLayout && this.MenuLayout.updateLocation)
            this.MenuLayout.updateLocation();
    }

    displayPinnedApps() {
        if(this.MenuLayout)
            this.MenuLayout.displayPinnedApps();
    }

    loadPinnedApps() {
        if(this.MenuLayout)
            this.MenuLayout.loadPinnedApps();
    }

    reload(){
        if(this.MenuLayout){
            this.reloadMenuLayout();
        }
    }

    shouldLoadPinnedApps(){
        if(this.MenuLayout)
            return this.MenuLayout.shouldLoadPinnedApps;
    }

    setDefaultMenuView(){
        if(this.MenuLayout)
            this.MenuLayout.setDefaultMenuView();
    }

    _onOpenStateChanged(menu, open) {
        if(open){
            //Avoid Super L hotkey conflicts with Pop Shell extension by
            //setting 'overlay-key' mode  to  Shell.ActionMode.ALL.
            let hotKeyPos = this._settings.get_enum('menu-hotkey');
            if(hotKeyPos === Constants.HotKey.SUPER_L)
                Main.wm.allowKeybinding('overlay-key', Shell.ActionMode.ALL);

            this.menuButtonWidget.setActiveStylePseudoClass(true);
            this.add_style_pseudo_class('active');

            if(Main.panel.menuManager && Main.panel.menuManager.activeMenu)
                Main.panel.menuManager.activeMenu.toggle();

            if(this.dtpPanel && !this.dtpNeedsRelease){
                if(this.dtpPanel.intellihide?.enabled){
                    this.dtpNeedsRelease = true;
                }
            }
        }
        else{
            if(!this.arcMenu.isOpen){
                if (this.tooltipShowingID) {
                    GLib.source_remove(this.tooltipShowingID);
                    this.tooltipShowingID = null;
                }
                this.tooltipShowing = false;
                if(this.tooltip){
                    this.tooltip.hide();
                    this.tooltip.sourceActor = null;
                }
            }
            if(!this.arcMenu.isOpen && !this.arcMenuContextMenu.isOpen){
                if(this.dtpPanel && this.dtpNeedsRelease && !this.dtpNeedsHiding){
                    this.dtpNeedsRelease = false;
                    this.dtpPanel.intellihide?.release(1);
                }
                if(this.dtpPanel && this.dtpNeedsHiding){
                    this.dtpNeedsHiding = false;
                    this.dtpPanel.panelBox.visible = false;
                }
                if(this.mainPanelNeedsHiding){
                    Main.layoutManager.panelBox.visible = false;
                    this.mainPanelNeedsHiding = false;
                }
                this.menuButtonWidget.setActiveStylePseudoClass(false);
                this.remove_style_pseudo_class('active');
            }
        }
    }
});

var ArcMenu = class ArcMenu_ArcMenu extends PopupMenu.PopupMenu{
    constructor(sourceActor, arrowAlignment, arrowSide, parent) {
        super(sourceActor, arrowAlignment, arrowSide);
        this._settings = sourceActor._settings;
        this._menuButton = parent || sourceActor;
        Main.uiGroup.add_child(this.actor);
        this.actor.hide();
        this._menuClosedID = this.connect('menu-closed', () => this._menuButton.setDefaultMenuView());
        this.connect('destroy', () => this._onDestroy());
    }

    open(animate){
        if(!this.isOpen){
            this._menuButton.arcMenu.actor._muteInput = false;
            this._menuButton.arcMenu.actor._muteKeys = false;
        }
        super.open(animate);
    }

    close(animate){
        if(this.isOpen){
            if(this._menuButton.contextMenuManager.activeMenu)
                this._menuButton.contextMenuManager.activeMenu.toggle();
            if(this._menuButton.subMenuManager.activeMenu)
                this._menuButton.subMenuManager.activeMenu.toggle();
        }

        super.close(animate);
    }

    _onDestroy(){
        if(this._menuClosedID){
            this.disconnect(this._menuClosedID)
            this._menuClosedID = null;
        }
    }
};

var ArcMenuContextMenu = class ArcMenu_ArcMenuContextMenu extends PopupMenu.PopupMenu {
    constructor(sourceActor, arrowAlignment, arrowSide) {
        super(sourceActor, arrowAlignment, arrowSide);
        this._settings = sourceActor._settings;
        this._menuButton = sourceActor;
        this.extensionSettingsItem = false;

        this.actor.add_style_class_name('panel-menu');
        Main.uiGroup.add_child(this.actor);
        this.actor.hide();

        let item = new PopupMenu.PopupSeparatorMenuItem(_("ArcMenu Settings"));
        item.add_style_class_name("popup-inactive-menu-item arcmenu-menu-item");
        this.addMenuItem(item);

        this.addMenuItem(this.createQuickLinkItem(_("General Settings"), Constants.PrefsVisiblePage.GENERAL));
        this.addMenuItem(this.createQuickLinkItem(_("Menu Theming"), Constants.PrefsVisiblePage.MENU_THEME));
        this.addMenuItem(this.createQuickLinkItem(_("Change Menu Layout"), Constants.PrefsVisiblePage.MENU_LAYOUT));
        this.addMenuItem(this.createQuickLinkItem(_("Layout Tweaks"), Constants.PrefsVisiblePage.LAYOUT_TWEAKS));
        this.addMenuItem(this.createQuickLinkItem(_("Customize Menu"), Constants.PrefsVisiblePage.CUSTOMIZE_MENU));
        this.addMenuItem(this.createQuickLinkItem(_("Button Settings"), Constants.PrefsVisiblePage.BUTTON_APPEARANCE));
        item = new MW.ArcMenuSeparator(Constants.SeparatorStyle.MAX, Constants.SeparatorAlignment.HORIZONTAL);
        this.addMenuItem(item);
        this.addMenuItem(this.createQuickLinkItem(_("About"), Constants.PrefsVisiblePage.ABOUT));
    }

    addExtensionSettings(){
        if(!this.extensionSettingsItem){
            let extensionCommand = 'gnome-extensions prefs ' + DASH_TO_PANEL_UUID;

            this.dashToPanelLink = new PopupMenu.PopupMenuItem(_("Dash to Panel Settings"));
            this.dashToPanelLink.add_style_class_name("arcmenu-menu-item");
            this.dashToPanelLink.connect('activate', ()=>{
                Util.spawnCommandLine(extensionCommand);
            });
            this.addMenuItem(this.dashToPanelLink, 0);

            this.extensionSettingsItem = true;
        }
    }

    removeExtensionSettings(){
        if(this.dashToPanelLink)
            this.dashToPanelLink.destroy();

        this.extensionSettingsItem = false;
    }

    createQuickLinkItem(title, prefsVisiblePage){
        let item = new PopupMenu.PopupMenuItem(_(title));
        item.add_style_class_name("arcmenu-menu-item");
        item.connect('activate', () => {
            this._settings.set_int('prefs-visible-page', prefsVisiblePage);
            Util.spawnCommandLine(Constants.ArcMenuSettingsCommand);
        });
        return item;
    }
};

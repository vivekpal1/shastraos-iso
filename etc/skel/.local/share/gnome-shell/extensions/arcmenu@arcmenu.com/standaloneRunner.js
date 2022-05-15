const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const {Clutter, GLib, Shell, St} = imports.gi;
const appSys = Shell.AppSystem.get_default();
const Constants = Me.imports.constants;
const Gettext = imports.gettext.domain(Me.metadata['gettext-domain']);
const Main = imports.ui.main;
const MenuButton = Me.imports.menuButton;
const MW = Me.imports.menuWidgets;
const PopupMenu = imports.ui.popupMenu;
const Utils = Me.imports.utils;
const _ = Gettext.gettext;

var StandaloneRunner = class ArcMenu_StandaloneRunner{
    constructor(settings) {
        this._settings = settings;

        this.tooltipShowing = false;
        this.tooltipShowingID = null;

        this.tooltip = new MW.Tooltip(this);

        this.dummyWidget = new St.Widget({ width: 0, height: 0, opacity: 0 });
        Main.uiGroup.add_child(this.dummyWidget);

        //Create Main Menus - ArcMenu and arcMenu's context menu
        this.arcMenu = new MenuButton.ArcMenu(this.dummyWidget, 0.5, St.Side.TOP, this);
        this.arcMenu.connect('open-state-changed', this._onOpenStateChanged.bind(this));

        this.arcMenu.actor.add_style_class_name('panel-menu');
        this.arcMenu.actor.add_style_class_name('arcmenu-menu');

        this.menuManager = new PopupMenu.PopupMenuManager(Main.panel);
        this.menuManager._changeMenu = (menu) => {};
        this.menuManager.addMenu(this.arcMenu);

        let rect = Main.layoutManager.getWorkAreaForMonitor(Main.layoutManager.primaryMonitor.index);

        //Position the runner menu in the center of the current monitor, at top of screen.
        let positionX = Math.round(rect.x + (rect.width / 2));
        let positionY = rect.y;
        this.dummyWidget.set_position(positionX, positionY);

        //Context Menus for applications and other menu items
        this.contextMenuManager = new PopupMenu.PopupMenuManager(this.dummyWidget);
        this.contextMenuManager._changeMenu = (menu) => {};
        this.contextMenuManager._onMenuSourceEnter = (menu) =>{
            if (this.contextMenuManager.activeMenu && this.contextMenuManager.activeMenu != menu)
                return Clutter.EVENT_STOP;

            return Clutter.EVENT_PROPAGATE;
        }

        //Sub Menu Manager - Control all other popup menus
        this.subMenuManager = new PopupMenu.PopupMenuManager(this.dummyWidget);
        this.subMenuManager._changeMenu = (menu) => {};
    }

    initiate(){
        this.setRecentApps();

        //Create Basic Layout
        this.createLayoutID = GLib.timeout_add(0, 100, () => {
            this.createMenuLayout();
            this.createLayoutID = null;
            return GLib.SOURCE_REMOVE;
        });
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
        this._forcedMenuLocation = false;
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

        const StandaloneRunner = true;
        this.MenuLayout = Utils.getMenuLayout(this, Constants.MenuLayout.RUNNER, StandaloneRunner);
        if(this.arcMenu.isOpen){
            if(this.MenuLayout.activeMenuItem)
                this.MenuLayout.activeMenuItem.active = true;
            else
                this.mainBox.grab_key_focus();
        }
    }

    reloadMenuLayout(){
        if(this.tooltip)
            this.tooltip.sourceActor = null;
        this._forcedMenuLocation = false;

        this.MenuLayout.destroy();
        this.MenuLayout = null;

        const StandaloneRunner = true;
        this.MenuLayout = Utils.getMenuLayout(this, Constants.MenuLayout.RUNNER, StandaloneRunner);

        if(this.arcMenu.isOpen){
            if(this.MenuLayout.activeMenuItem)
                this.MenuLayout.activeMenuItem.active = true;
            else
                this.mainBox.grab_key_focus();
        }
    }

    toggleMenu(){
        if(this.contextMenuManager.activeMenu)
            this.contextMenuManager.activeMenu.toggle();
        if(this.subMenuManager.activeMenu)
            this.subMenuManager.activeMenu.toggle();

        if(!this.arcMenu.isOpen){
            this.MenuLayout.updateLocation();
            this.arcMenu.toggle();
            if(this.arcMenu.isOpen)
                this.mainBox.grab_key_focus();
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
        else
            return null;
    }

    destroy(){
        if(this.createLayoutID){
            GLib.source_remove(this.createLayoutID);
            this.createLayoutID = null;
        }

        if(this.updateMenuLayoutID){
            GLib.source_remove(this.updateMenuLayoutID);
            this.updateMenuLayoutID = null;
        }

        if (this.tooltipShowingID) {
            GLib.source_remove(this.tooltipShowingID);
            this.tooltipShowingID = null;
        }

        if(this.tooltip)
            this.tooltip.destroy();
        if(this._installedChangedId){
            appSys.disconnect(this._installedChangedId);
            this._installedChangedId = null;
        }

        if(this.MenuLayout)
            this.MenuLayout.destroy();
        if(this.arcMenu)
            this.arcMenu.destroy();
        if(this.dummyWidget){
            Main.uiGroup.remove_child(this.dummyWidget);
            this.dummyWidget.destroy();
        }
    }

    updateMenuLayout(){
    }

    loadExtraPinnedApps(){
        if(this.MenuLayout)
            this.MenuLayout.loadExtraPinnedApps();
    }

    updateLocation(){
        if(this.MenuLayout)
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
            if(Main.panel.menuManager && Main.panel.menuManager.activeMenu)
                Main.panel.menuManager.activeMenu.toggle();
        }
        else{
            if(!this.arcMenu.isOpen){
                if (this.tooltipShowingID) {
                    GLib.source_remove(this.tooltipShowingID);
                    this.tooltipShowingID = null;
                }
                this.tooltipShowing = false;
                if(this.activeTooltip){
                    this.activeTooltip.hide();
                }
            }
        }
    }
};

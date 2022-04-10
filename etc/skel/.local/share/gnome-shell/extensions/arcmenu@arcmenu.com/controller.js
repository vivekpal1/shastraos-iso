const Me = imports.misc.extensionUtils.getCurrentExtension();

const {Gio, GLib, Gtk, St} = imports.gi;
const Constants = Me.imports.constants;
const Keybinder = Me.imports.keybinder;
const Main = imports.ui.main;
const MenuButton = Me.imports.menuButton;
const {StandaloneRunner} = Me.imports.standaloneRunner;
const Utils = Me.imports.utils;

var MenuSettingsController = class {
    constructor(settings, settingsControllers, panel, isPrimaryPanel) {
        this._settings = settings;
        this.panel = panel;

        global.toggleArcMenu = () => this.toggleMenus();

        this.currentMonitorIndex = 0;
        this._activitiesButton = Main.panel.statusArea.activities;
        this.isPrimaryPanel = isPrimaryPanel;

        this._menuButton = new MenuButton.MenuButton(settings, panel);

        this._settingsControllers = settingsControllers

        if(this.isPrimaryPanel){
            this._overrideOverlayKey = new Keybinder.OverrideOverlayKey();
            this._customKeybinding = new Keybinder.CustomKeybinding(this._settings); 
        }
        this._applySettings();
    }

    // Load and apply the settings from the arc-menu settings
    _applySettings() {
        if(this.isPrimaryPanel){
            this._updateHotKeyBinder();
        }
            
        this._setButtonAppearance();
        this._setButtonText();
        this._setButtonIcon();
        this._setButtonIconSize();
        this._setButtonIconPadding();
        this._configureActivitiesButton();
    }
    // Bind the callbacks for handling the settings changes to the event signals
    bindSettingsChanges() {
        this.settingsChangeIds = [
            this._settings.connect('changed::menu-hotkey', this._updateHotKeyBinder.bind(this)),
            this._settings.connect('changed::runner-menu-hotkey', this._updateHotKeyBinder.bind(this)),
            this._settings.connect('changed::enable-standlone-runner-menu', this._updateHotKeyBinder.bind(this)),
            this._settings.connect('changed::position-in-panel', this._setButtonPosition.bind(this)),
            this._settings.connect('changed::menu-button-position-offset', this._setButtonPosition.bind(this)),
            this._settings.connect('changed::menu-position-alignment', this._setMenuPositionAlignment.bind(this)),
            this._settings.connect('changed::menu-button-appearance', this._setButtonAppearance.bind(this)),
            this._settings.connect('changed::custom-menu-button-text', this._setButtonText.bind(this)),
            this._settings.connect('changed::menu-button-icon', this._setButtonIcon.bind(this)),
            this._settings.connect('changed::distro-icon', this._setButtonIcon.bind(this)),
            this._settings.connect('changed::arc-menu-icon', this._setButtonIcon.bind(this)),
            this._settings.connect('changed::custom-menu-button-icon', this._setButtonIcon.bind(this)),
            this._settings.connect('changed::custom-menu-button-icon-size', this._setButtonIconSize.bind(this)),
            this._settings.connect('changed::button-padding', this._setButtonIconPadding.bind(this)),
            this._settings.connect('changed::directory-shortcuts-list', this._reload.bind(this)),
            this._settings.connect('changed::application-shortcuts-list', this._reload.bind(this)),
            this._settings.connect('changed::disable-recently-installed-apps', this._initiateRecentlyInstalledApps.bind(this)),
            this._settings.connect('changed::extra-categories', this._reload.bind(this)),
            this._settings.connect('changed::power-options', this._reload.bind(this)),
            this._settings.connect('changed::show-external-devices', this._reload.bind(this)),
            this._settings.connect('changed::show-bookmarks', this._reload.bind(this)),
            this._settings.connect('changed::disable-user-avatar', this._reload.bind(this)),
            this._settings.connect('changed::avatar-style', this._reload.bind(this)),
            this._settings.connect('changed::enable-activities-shortcut', this._reload.bind(this)),
            this._settings.connect('changed::enable-horizontal-flip', this._reload.bind(this)),
            this._settings.connect('changed::searchbar-default-bottom-location', this._reload.bind(this)),
            this._settings.connect('changed::searchbar-default-top-location', this._reload.bind(this)),
            this._settings.connect('changed::multi-lined-labels', this._reload.bind(this)),
            this._settings.connect('changed::apps-show-extra-details', this._reload.bind(this)),
            this._settings.connect('changed::show-search-result-details', this._reload.bind(this)),
            this._settings.connect('changed::search-provider-open-windows', this._reload.bind(this)),
            this._settings.connect('changed::search-provider-recent-files', this._reload.bind(this)),
            this._settings.connect('changed::disable-scrollview-fade-effect', this._reload.bind(this)),
            this._settings.connect('changed::menu-height', this._updateMenuHeight.bind(this)),
            this._settings.connect('changed::left-panel-width', this._updateMenuWidth.bind(this)),
            this._settings.connect('changed::right-panel-width', this._updateMenuWidth.bind(this)),
            this._settings.connect('changed::menu-width-adjustment', this._updateMenuWidth.bind(this)),
            this._settings.connect('changed::pinned-app-list',this._updatePinnedApps.bind(this)),
            this._settings.connect('changed::enable-weather-widget-unity',this._updatePinnedApps.bind(this)),
            this._settings.connect('changed::enable-clock-widget-unity',this._updatePinnedApps.bind(this)),
            this._settings.connect('changed::enable-weather-widget-raven',this._updatePinnedApps.bind(this)),
            this._settings.connect('changed::enable-clock-widget-raven',this._updatePinnedApps.bind(this)),
            this._settings.connect('changed::brisk-shortcuts-list',this._updateExtraPinnedApps.bind(this)),
            this._settings.connect('changed::mint-pinned-app-list',this._updateExtraPinnedApps.bind(this)),
            this._settings.connect('changed::mint-separator-index',this._updateExtraPinnedApps.bind(this)),
            this._settings.connect('changed::unity-pinned-app-list',this._updateExtraPinnedApps.bind(this)),
            this._settings.connect('changed::unity-separator-index',this._updateExtraPinnedApps.bind(this)),
            this._settings.connect('changed::windows-disable-frequent-apps', this._reload.bind(this)),
            this._settings.connect('changed::windows-disable-pinned-apps', this._reload.bind(this)),
            this._settings.connect('changed::default-menu-view', this._reload.bind(this)),
            this._settings.connect('changed::default-menu-view-tognee',this._reload.bind(this)),
            this._settings.connect('changed::alphabetize-all-programs',this._reload.bind(this)),
            this._settings.connect('changed::enable-unity-homescreen',this._setDefaultMenuView.bind(this)),
            this._settings.connect('changed::menu-layout', this._updateMenuLayout.bind(this)),
            this._settings.connect('changed::menu-item-grid-icon-size', this._reload.bind(this)),
            this._settings.connect('changed::menu-item-icon-size', this._reload.bind(this)),
            this._settings.connect('changed::button-item-icon-size', this._reload.bind(this)),
            this._settings.connect('changed::quicklinks-item-icon-size', this._reload.bind(this)),
            this._settings.connect('changed::misc-item-icon-size', this._reload.bind(this)),
            this._settings.connect('changed::runner-position', this.updateLocation.bind(this)),
            this._settings.connect('changed::runner-show-frequent-apps', this._reload.bind(this)),
            this._settings.connect('changed::show-activities-button', this._configureActivitiesButton.bind(this)),
            this._settings.connect('changed::force-menu-location', this._forceMenuLocation.bind(this)),
            this._settings.connect('changed::category-icon-type', this._reload.bind(this)),
            this._settings.connect('changed::shortcut-icon-type', this._reload.bind(this)),
            this._settings.connect('changed::arcmenu-extra-categories-links', this._reload.bind(this)),
            this._settings.connect('changed::arcmenu-extra-categories-links-location', this._reload.bind(this)),
        ];
    }

    _reload(){
        this._menuButton.reload();
        if(this.runnerMenu)
            this.runnerMenu.reload();
    }

    _forceMenuLocation(){
        this._menuButton.forceMenuLocation();
    }

    _initiateRecentlyInstalledApps(){
        this._menuButton.initiateRecentlyInstalledApps();
        this._menuButton.reload();
        if(this.runnerMenu){
            this.runnerMenu.initiateRecentlyInstalledApps();
            this.runnerMenu.reload();
        } 
    }

    updateLocation(){
        this._menuButton.updateLocation();
        if(this.runnerMenu)
            this.runnerMenu.updateLocation();
    }

    _updateMenuLayout(){
        this._menuButton.updateMenuLayout();
    }

    _setDefaultMenuView(){
        this._menuButton.setDefaultMenuView();
    }

    toggleStandaloneRunner(){
        this._closeAllArcMenus();
        if(this.runnerMenu)
            this.runnerMenu.toggleMenu();
    }

    toggleMenus(){
        if(this.runnerMenu && this.runnerMenu.arcMenu.isOpen)
            this.runnerMenu.toggleMenu();
        if(global.dashToPanel){
            const MultipleArcMenus = this._settingsControllers.length > 1;
            const ShowArcMenuOnPrimaryMonitor = this._settings.get_boolean('hotkey-open-primary-monitor');
            if(MultipleArcMenus && ShowArcMenuOnPrimaryMonitor)
                this._toggleMenuOnMonitor(Main.layoutManager.primaryMonitor);
            else if(MultipleArcMenus && !ShowArcMenuOnPrimaryMonitor)
                this._toggleMenuOnMonitor(Main.layoutManager.currentMonitor);
            else
                this._menuButton.toggleMenu();
        }
        else
            this._menuButton.toggleMenu();
    }

    _toggleMenuOnMonitor(monitor){
        for (let i = 0; i < this._settingsControllers.length; i++) {
            let menuButton = this._settingsControllers[i]._menuButton;
            let monitorIndex = this._settingsControllers[i].monitorIndex;
            if(monitor.index === monitorIndex)
                this.currentMonitorIndex = i;
            else{
                if(menuButton.arcMenu.isOpen)
                    menuButton.toggleMenu();
                if(menuButton.arcMenuContextMenu.isOpen)
                    menuButton.toggleArcMenuContextMenu();
            }
        } 
        //open the current monitors menu
        this._settingsControllers[this.currentMonitorIndex]._menuButton.toggleMenu();
    }

    _closeAllArcMenus(){
        for (let i = 0; i < this._settingsControllers.length; i++) {
            let menuButton = this._settingsControllers[i]._menuButton;
            if(menuButton.arcMenu.isOpen)
                menuButton.toggleMenu();
            if(menuButton.arcMenuContextMenu.isOpen)
                menuButton.toggleArcMenuContextMenu();
        }
    }

    _updateMenuHeight(){
        this._menuButton.updateHeight();
    }

    _updateMenuWidth(){
        this._menuButton.updateWidth();
    }

    _updatePinnedApps(){
        if(this._menuButton.shouldLoadPinnedApps())
            this._menuButton.loadPinnedApps();

        //If the active category is Pinned Apps, redisplay the new Pinned Apps
        const activeCategory = this._menuButton.MenuLayout?.activeCategoryType;
        if(!activeCategory)
            return;
        if(activeCategory === Constants.CategoryType.PINNED_APPS || activeCategory === Constants.CategoryType.HOME_SCREEN)
            this._menuButton.displayPinnedApps();  
    }

    _updateExtraPinnedApps(){
        let layout = this._settings.get_enum('menu-layout');
        if(layout == Constants.MenuLayout.UNITY || layout == Constants.MenuLayout.MINT || layout == Constants.MenuLayout.BRISK){
            if(this._menuButton.shouldLoadPinnedApps())
                this._menuButton.loadExtraPinnedApps();
        }
    }

    _updateHotKeyBinder() {
        if (this.isPrimaryPanel) {
            const RunnerHotKey = this._settings.get_enum('runner-menu-hotkey');
            const HotKey = this._settings.get_enum('menu-hotkey');
            const EnableStandaloneRunnerMenu = this._settings.get_boolean('enable-standlone-runner-menu');

            this._customKeybinding.unbind('ToggleArcMenu');
            this._customKeybinding.unbind('ToggleRunnerMenu');
            this._overrideOverlayKey.disable();

            if(EnableStandaloneRunnerMenu){
                if(!this.runnerMenu){
                    this.runnerMenu = new StandaloneRunner(this._settings);
                    this.runnerMenu.initiate();
                }
                if(RunnerHotKey === Constants.RunnerHotKey.CUSTOM){
                    this._customKeybinding.bind('ToggleRunnerMenu', 'toggle-runner-menu', () => this.toggleStandaloneRunner());
                }
                else if(RunnerHotKey === Constants.RunnerHotKey.SUPER_L){
                    this._overrideOverlayKey.enable(() => this.toggleStandaloneRunner());
                }
            }
            else if(this.runnerMenu){
                this.runnerMenu.destroy();
                this.runnerMenu = null;
            }

            if(HotKey === Constants.HotKey.CUSTOM){
                this._customKeybinding.bind('ToggleArcMenu', 'toggle-arcmenu', () => this.toggleMenus());
            }
            else if(HotKey === Constants.HotKey.SUPER_L){
                this._overrideOverlayKey.disable();
                this._overrideOverlayKey.enable(() => this.toggleMenus());
            }
        }
    }

    // Place the menu button to main panel as specified in the settings
    _setButtonPosition() {
        if (this._isButtonEnabled()) {
            this._removeMenuButtonFromMainPanel();
            this._addMenuButtonToMainPanel();
            this._setMenuPositionAlignment();
        }
    }

    _setMenuPositionAlignment(){
        this._menuButton.setMenuPositionAlignment();
    }
    
    // Change the menu button appearance as specified in the settings
    _setButtonAppearance() {
        let menuButtonWidget = this._menuButton.menuButtonWidget;
        this._menuButton.container.set_width(-1);
        this._menuButton.container.set_height(-1);
        menuButtonWidget.actor.show();
        switch (this._settings.get_enum('menu-button-appearance')) {
            case Constants.MenuButtonAppearance.TEXT:
                menuButtonWidget.hidePanelIcon();
                menuButtonWidget.showPanelText();
                break;
            case Constants.MenuButtonAppearance.ICON_TEXT:
                menuButtonWidget.hidePanelIcon();
                menuButtonWidget.hidePanelText();
                menuButtonWidget.showPanelIcon();
                menuButtonWidget.showPanelText();
                menuButtonWidget.setPanelTextStyle('padding-left: 5px;');
                break;
            case Constants.MenuButtonAppearance.TEXT_ICON:
                menuButtonWidget.hidePanelIcon();
                menuButtonWidget.hidePanelText();
                menuButtonWidget.showPanelText();
                menuButtonWidget.setPanelTextStyle('padding-right: 5px;');
                menuButtonWidget.showPanelIcon();
                break;
            case Constants.MenuButtonAppearance.NONE:
                menuButtonWidget.actor.hide();
                this._menuButton.container.set_width(0);
                this._menuButton.container.set_height(0);
                break;
            case Constants.MenuButtonAppearance.ICON: /* falls through */
            default:
                menuButtonWidget.hidePanelText();
                menuButtonWidget.showPanelIcon();
        }
    }

    // Update the text of the menu button as specified in the settings
    _setButtonText() {
        // Update the text of the menu button
        let menuButtonWidget = this._menuButton.menuButtonWidget;
        let label = menuButtonWidget.getPanelLabel();

        let customTextLabel = this._settings.get_string('custom-menu-button-text');
        label.set_text(customTextLabel);
    }

    // Update the icon of the menu button as specified in the settings
    _setButtonIcon() {
        let path = this._settings.get_string('custom-menu-button-icon');
        let menuButtonWidget = this._menuButton.menuButtonWidget;
        let stIcon = menuButtonWidget.getPanelIcon();
        
        let iconString = Utils.getMenuButtonIcon(this._settings, path);
        stIcon.set_gicon(Gio.icon_new_for_string(iconString));
    }

    // Update the icon of the menu button as specified in the settings
    _setButtonIconSize() {
        let menuButtonWidget = this._menuButton.menuButtonWidget;
        let stIcon = menuButtonWidget.getPanelIcon();
        let iconSize = this._settings.get_double('custom-menu-button-icon-size');
        let size = iconSize;
        stIcon.icon_size = size;
    }

    _setButtonIconPadding() {
        let padding = this._settings.get_int('button-padding');
        if(padding > -1)
            this._menuButton.style = "-natural-hpadding: " + (padding  * 2 ) + "px; -minimum-hpadding: " + padding + "px;";
        else
            this._menuButton.style = null;

        let parent = this._menuButton.get_parent();
        if(!parent)
            return;
        let children = parent.get_children();
        let actorIndex = 0;

        if (children.length > 1) {
            actorIndex = children.indexOf(this._menuButton);
        }

        parent.remove_child(this._menuButton);
        parent.insert_child_at_index(this._menuButton, actorIndex);
    }

    // Get the current position of the menu button and its associated position order
    _getMenuPosition() {
        let offset = this._settings.get_int('menu-button-position-offset');
        switch (this._settings.get_enum('position-in-panel')) {
            case Constants.MenuPosition.CENTER:
                return [offset, 'center'];
            case Constants.MenuPosition.RIGHT:
                // get number of childrens in rightBox (without arcmenu)
                let n_children = Main.panel._rightBox.get_n_children();
                n_children -= Main.panel.statusArea.ArcMenu !== undefined;
                // position where icon should go,
                // offset = 0, icon should be last
                // offset = 1, icon should be second last
                const order = Math.clamp(n_children - offset, 0, n_children);
                return [order, 'right'];
            case Constants.MenuPosition.LEFT:
            default:
                return [offset, 'left'];
        }
    }

    _configureActivitiesButton(){
        let isActivitiesButtonPresent = Main.panel.statusArea.activities && Main.panel.statusArea.activities.container && Main.panel._leftBox.contains(Main.panel.statusArea.activities.container);
        let showActivities = this._settings.get_boolean('show-activities-button'); 
        
        let container = Main.panel.statusArea.activities.container;
        let parent = container.get_parent();
        let index = 0;
        if(this._settings.get_enum('position-in-panel') === Constants.MenuPosition.LEFT && 
            this._settings.get_int('menu-button-position-offset') == 0)
            index = 1;

        if(showActivities && !isActivitiesButtonPresent){
            parent ? parent.remove_child(container) : null;
            Main.panel._leftBox.insert_child_at_index(this._activitiesButton.container, index);
        }                          
        else if(!showActivities && isActivitiesButtonPresent)
            Main.panel._leftBox.remove_child(Main.panel.statusArea.activities.container);
    }

    // Check if the activities button is present on the main panel
    _isActivitiesButtonPresent() {
        return (this._activitiesButton &&
            this._activitiesButton.container &&
            Main.panel._leftBox.contains(this._activitiesButton.container));
    }

    // Add or restore the activities button on the main panel
    _addActivitiesButtonToMainPanel() {
        if (!this._isActivitiesButtonPresent()) {
            // Retsore the activities button at the default position
            let parent = this._activitiesButton.container.get_parent();
            if(!parent)
                Main.panel._leftBox.insert_child_at_index(this._activitiesButton.container, 0);
        }
    }

    // Add the menu button to the main panel
    _addMenuButtonToMainPanel() {
        let [position, box] = this._getMenuPosition();
        this.panel.addToStatusArea('ArcMenu', this._menuButton, position, box);
    }

    // Remove the menu button from the main panel
    _removeMenuButtonFromMainPanel() {
        this.panel.menuManager.removeMenu(this._menuButton.arcMenu);
        this.panel.menuManager.removeMenu(this._menuButton.arcMenuContextMenu);
        this.panel.statusArea['ArcMenu'] = null;
    }

    // Enable the menu button
    enableButton() {
        this._addMenuButtonToMainPanel();
        this._menuButton.initiate();
    }
    _disableButton() {
        this._removeMenuButtonFromMainPanel();
        this._addActivitiesButtonToMainPanel();
        this._menuButton.destroy();
    }

    _isButtonEnabled() {
        return this.panel.statusArea['ArcMenu'] !== null;
    }

    destroy() {
        if(this.runnerMenu){
            this.runnerMenu.destroy();
        }
        this.settingsChangeIds.forEach(id => this._settings.disconnect(id));
        
        if(this.panel == undefined)
            this._menuButton.destroy();
        else if (this._isButtonEnabled()) {
            this._disableButton();
        }

        if(this.isPrimaryPanel){
            this._overrideOverlayKey.destroy();
            this._customKeybinding.destroy();
        }
        this._settings = null;
        this._activitiesButton = null;
        this._menuButton = null;
        delete global.toggleArcMenu;
  }
};

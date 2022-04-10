const Me = imports.misc.extensionUtils.getCurrentExtension();
const Constants = Me.imports.constants;
const {Gio, GLib} = imports.gi;

const PowerManagerInterface = `<node>
  <interface name="org.freedesktop.login1.Manager">
    <method name="HybridSleep">
      <arg type="b" direction="in"/>
    </method>
    <method name="CanHybridSleep">
      <arg type="s" direction="out"/>
    </method>
    <method name="Hibernate">
      <arg type="b" direction="in"/>
    </method>
    <method name="CanHibernate">
      <arg type="s" direction="out"/>
    </method>
  </interface>
</node>`;
const PowerManager = Gio.DBusProxy.makeProxyWrapper(PowerManagerInterface);

function activateHibernate(){
    let proxy = new PowerManager(Gio.DBus.system, 'org.freedesktop.login1', '/org/freedesktop/login1');
    proxy.CanHibernateRemote((result, error) => {
        if(error || result[0] !== 'yes')
            imports.ui.main.notifyError(_("ArcMenu - Hibernate Error!"), _("System unable to hibernate."));
        else{
            proxy.HibernateRemote(true);
        }
    });
}

function activateHybridSleep(){
    let proxy = new PowerManager(Gio.DBus.system, 'org.freedesktop.login1', '/org/freedesktop/login1');
    proxy.CanHybridSleepRemote((result, error) => {
        if(error || result[0] !== 'yes')
            imports.ui.main.notifyError(_("ArcMenu - Hybrid Sleep Error!"), _("System unable to hybrid sleep."));
        else{
            proxy.HybridSleepRemote(true);
        }
    });
}

function getMenuLayout(menuButton, layout, isStandaloneRunner){
    let MenuLayout = Me.imports.menulayouts;
    switch(layout){
        case Constants.MenuLayout.ARCMENU:
            return new MenuLayout.arcmenu.createMenu(menuButton);
        case Constants.MenuLayout.BRISK:
            return new MenuLayout.brisk.createMenu(menuButton); 
        case Constants.MenuLayout.WHISKER:
            return new MenuLayout.whisker.createMenu(menuButton); 
        case Constants.MenuLayout.GNOME_MENU:
            return new MenuLayout.gnomemenu.createMenu(menuButton); 
        case Constants.MenuLayout.MINT:
            return new MenuLayout.mint.createMenu(menuButton); 
        case Constants.MenuLayout.GNOME_OVERVIEW:
            return null;
        case Constants.MenuLayout.ELEMENTARY:
            return new MenuLayout.elementary.createMenu(menuButton); 
        case Constants.MenuLayout.REDMOND:
            return new MenuLayout.redmond.createMenu(menuButton); 
        case Constants.MenuLayout.UNITY:
            return new MenuLayout.unity.createMenu(menuButton); 
        case Constants.MenuLayout.BUDGIE:
            return new MenuLayout.budgie.createMenu(menuButton);
        case Constants.MenuLayout.INSIDER:
            return new MenuLayout.insider.createMenu(menuButton);
        case Constants.MenuLayout.RUNNER:
            return new MenuLayout.runner.createMenu(menuButton, isStandaloneRunner);
        case Constants.MenuLayout.CHROMEBOOK:
            return new MenuLayout.chromebook.createMenu(menuButton);
        case Constants.MenuLayout.RAVEN:
            return new MenuLayout.raven.createMenu(menuButton);
        case Constants.MenuLayout.TOGNEE:
            return new MenuLayout.tognee.createMenu(menuButton);
        case Constants.MenuLayout.PLASMA:
            return new MenuLayout.plasma.createMenu(menuButton);
        case Constants.MenuLayout.WINDOWS:
            return new MenuLayout.windows.createMenu(menuButton);
        case Constants.MenuLayout.LAUNCHER:
            return new MenuLayout.launcher.createMenu(menuButton);
        case Constants.MenuLayout.ELEVEN:
            return new MenuLayout.eleven.createMenu(menuButton);
        case Constants.MenuLayout.AZ:
            return new MenuLayout.az.createMenu(menuButton);
        default:
            return new MenuLayout.arcmenu.createMenu(menuButton);    
    }
}

function getSettings(schema, extensionUUID) {
    let extension = imports.ui.main.extensionManager.lookup(extensionUUID);
  
    if (!extension)
        throw new Error('ArcMenu - getSettings() unable to find extension');

    schema = schema || extension.metadata['settings-schema'];

    const GioSSS = Gio.SettingsSchemaSource;

    // Expect USER extensions to have a schemas/ subfolder, otherwise assume a
    // SYSTEM extension that has been installed in the same prefix as the shell
    let schemaDir = extension.dir.get_child('schemas');
    let schemaSource;
    if (schemaDir.query_exists(null)) {
        schemaSource = GioSSS.new_from_directory(schemaDir.get_path(),
                                                GioSSS.get_default(),
                                                false);
    } else {
        schemaSource = GioSSS.get_default();
    }

    let schemaObj = schemaSource.lookup(schema, true);
    if (!schemaObj)
        throw new Error(`Schema ${schema} could not be found for extension ${extension.metadata.uuid}. Please check your installation`);

    return new Gio.Settings({ settings_schema: schemaObj });
}

function convertToGridLayout(item){
    const Clutter = imports.gi.Clutter;
    const settings = item._settings;
    const layoutProperties = item._menuLayout.layoutProperties;

    let icon = item._icon ? item._icon : item._iconBin;

    item.vertical = true;
    if(item._ornamentLabel)
        item.remove_child(item._ornamentLabel);

    item.tooltipLocation = Constants.TooltipLocation.BOTTOM_CENTERED;
    item.label.x_align = item.label.y_align = Clutter.ActorAlign.CENTER;
    item.label.y_expand = true;

    icon.y_align = Clutter.ActorAlign.CENTER;
    icon.y_expand = true;
    if(settings.get_boolean('multi-lined-labels')){
        icon.y_align = Clutter.ActorAlign.TOP;
        icon.y_expand = false;

        let clutterText = item.label.get_clutter_text();
        clutterText.set({
            line_wrap: true,
            line_wrap_mode: imports.gi.Pango.WrapMode.WORD_CHAR,
        });
    }

    if(item._indicator){
        item.remove_child(item._indicator);
        item.insert_child_at_index(item._indicator, 0);
        item._indicator.x_align = Clutter.ActorAlign.CENTER;
        item._indicator.y_align = Clutter.ActorAlign.START;
        item._indicator.y_expand = false;
    }

    const iconSizeEnum = settings.get_enum('menu-item-grid-icon-size');
    let defaultIconStyle = layoutProperties.DefaultIconGridStyle;      

    iconSize = getGridIconStyle(iconSizeEnum, defaultIconStyle);
    item.name = iconSize;
}

function getIconSize(iconSizeEnum, defaultIconSize){
    const IconSizeEnum = iconSizeEnum;
    let iconSize = defaultIconSize;
    if(IconSizeEnum === Constants.IconSize.DEFAULT)
        iconSize = defaultIconSize;
    else if(IconSizeEnum === Constants.IconSize.EXTRA_SMALL)
        iconSize = Constants.EXTRA_SMALL_ICON_SIZE;
    else if(IconSizeEnum === Constants.IconSize.SMALL)
        iconSize = Constants.SMALL_ICON_SIZE;
    else if(IconSizeEnum === Constants.IconSize.MEDIUM)
        iconSize = Constants.MEDIUM_ICON_SIZE;
    else if(IconSizeEnum === Constants.IconSize.LARGE)
        iconSize = Constants.LARGE_ICON_SIZE;
    else if(IconSizeEnum === Constants.IconSize.EXTRA_LARGE)
        iconSize = Constants.EXTRA_LARGE_ICON_SIZE;

    return iconSize;
}

function getGridIconSize(iconSizeEnum, defaultIconStyle){
    let iconSize;
    if(iconSizeEnum === Constants.GridIconSize.DEFAULT){
        Constants.GridIconInfo.forEach((info) => {
            if(info.NAME === defaultIconStyle){
                iconSize = info.ICON_SIZE;
            }
        });
    }
    else
        iconSize = Constants.GridIconInfo[iconSizeEnum - 1].ICON_SIZE;
    
    return iconSize;
}

function getGridIconStyle(iconSizeEnum, defaultIconStyle){
    const IconSizeEnum = iconSizeEnum;
    let iconStyle = defaultIconStyle;
    if(IconSizeEnum === Constants.GridIconSize.DEFAULT)
        iconStyle = defaultIconStyle;
    else if(IconSizeEnum === Constants.GridIconSize.SMALL)
        iconStyle = 'SmallIconGrid';
    else if(IconSizeEnum === Constants.GridIconSize.MEDIUM)
        iconStyle = 'MediumIconGrid';
    else if(IconSizeEnum === Constants.GridIconSize.LARGE)
        iconStyle = 'LargeIconGrid';
    else if(IconSizeEnum === Constants.GridIconSize.SMALL_RECT)
        iconStyle = 'SmallRectIconGrid';
    else if(IconSizeEnum === Constants.GridIconSize.MEDIUM_RECT)
        iconStyle = 'MediumRectIconGrid';
    else if(IconSizeEnum === Constants.GridIconSize.LARGE_RECT)
        iconStyle = 'LargeRectIconGrid';

    return iconStyle;
}

function getCategoryDetails(currentCategory, categoryIconType){
    let name, gicon, iconName, fallbackIconName;
    for(let entry of Constants.Categories){
        if(entry.CATEGORY === currentCategory){
            name = entry.NAME;
            if(categoryIconType === Constants.CategoryIconType.FULL_COLOR)
                iconName = entry.FULL_COLOR_ICON;
            else
                iconName = entry.ICON;
            return [name, gicon, iconName, fallbackIconName];
        }
    }
    if(currentCategory === Constants.CategoryType.HOME_SCREEN){
        name = _("Home Screen");  
        gicon = Gio.icon_new_for_string(Me.path + '/media/icons/menu_icons/homescreen-symbolic.svg');
        return [name, gicon, iconName, fallbackIconName];
    }
    else{
        name = currentCategory.get_name();
        if(categoryIconType === Constants.CategoryIconType.FULL_COLOR)
            gicon = currentCategory.get_icon() ? currentCategory.get_icon() : null;
        else
            iconName = currentCategory.get_icon().to_string() + "-symbolic";
        fallbackIconName = currentCategory.get_icon() ? currentCategory.get_icon().to_string() : null;
        return [name, gicon, iconName, fallbackIconName];
    }
}

function activateCategory(currentCategory, menuLayout, menuItem, extraParams = false){
    if(currentCategory === Constants.CategoryType.HOME_SCREEN){
        menuLayout.activeCategory = _("Pinned Apps");
        menuLayout.displayPinnedApps();
    }
    else if(currentCategory === Constants.CategoryType.PINNED_APPS)
        menuLayout.displayPinnedApps();
    else if(currentCategory === Constants.CategoryType.FREQUENT_APPS){
        menuLayout.setFrequentAppsList(menuItem);
        menuLayout.displayCategoryAppList(menuItem.appList, currentCategory, extraParams ? menuItem : null);
    }
    else if(currentCategory === Constants.CategoryType.ALL_PROGRAMS)
        menuLayout.displayCategoryAppList(menuItem.appList, currentCategory, extraParams ? menuItem : null);
    else if(currentCategory === Constants.CategoryType.RECENT_FILES)
        menuLayout.displayRecentFiles();
    else
        menuLayout.displayCategoryAppList(menuItem.appList, currentCategory, extraParams ? menuItem : null);          

    menuLayout.activeCategoryType = currentCategory;  
}

function getMenuButtonIcon(settings, path){
    let iconType = settings.get_enum('menu-button-icon');

    if(iconType === Constants.MenuIcon.CUSTOM){
        if(path && GLib.file_test(path, GLib.FileTest.IS_REGULAR))
            return path;
    }
    else if(iconType === Constants.MenuIcon.DISTRO_ICON){
        let iconEnum = settings.get_int('distro-icon');
        path = Me.path + Constants.DistroIcons[iconEnum].PATH;
        if(Constants.DistroIcons[iconEnum].PATH === 'start-here-symbolic')
            return 'start-here-symbolic';
        else if(GLib.file_test(path, GLib.FileTest.IS_REGULAR))
            return path;   
    }
    else{
        let iconEnum = settings.get_int('arc-menu-icon');
        path = Me.path + Constants.MenuIcons[iconEnum].PATH;
        if(GLib.file_test(path, GLib.FileTest.IS_REGULAR))
            return path;
    }

    global.log("ArcMenu Error - Failed to set menu button icon. Set to System Default.");
    return 'start-here-symbolic';
}

function findSoftwareManager(){
    let softwareManager = null;
    let appSys = imports.gi.Shell.AppSystem.get_default();

    for(let softwareManagerID of Constants.SoftwareManagerIDs){
        if(appSys.lookup_app(softwareManagerID)){
            softwareManager = softwareManagerID;
            break;
        }
    }

    return softwareManager;
}

function areaOfTriangle(p1, p2, p3){
    return Math.abs((p1[0] * (p2[1] - p3[1]) + p2[0] * (p3[1] - p1[1]) + p3[0] * (p1[1] - p2[1])) / 2.0);
}

function ensureActorVisibleInScrollView(actor) {
    let box = actor.get_allocation_box();
    let y1 = box.y1, y2 = box.y2;
    
    let parent = actor.get_parent();
    while (!(parent instanceof imports.gi.St.ScrollView)) {
        if (!parent)
            return;

        box = parent.get_allocation_box();
        y1 += box.y1;
        y2 += box.y1;
        parent = parent.get_parent();    
    }

    let adjustment = parent.vscroll.adjustment;
    let [value, lower_, upper, stepIncrement_, pageIncrement_, pageSize] = adjustment.get_values();

    let offset = 0;
    let vfade = parent.get_effect("fade");
    if (vfade)
        offset = vfade.fade_margins.top;

    if (y1 < value + offset)
        value = Math.max(0, y1 - offset);
    else if (y2 > value + pageSize - offset)
        value = Math.min(upper, y2 + offset - pageSize);
    else
        return;
    adjustment.set_value(value);  
}

function getDashToPanelPosition(settings, index){
    var positions = null;
    var side;

    try{
        positions = JSON.parse(settings.get_string('panel-positions'))
    } catch(e){
        log('Error parsing Dash to Panel positions: ' + e.message);
    }
    
    if(!positions)
        side = settings.get_string('panel-position');
    else{
        side = positions[index];
    }

    if (side === 'TOP') 
        return imports.gi.St.Side.TOP;
    else if (side === 'RIGHT') 
        return imports.gi.St.Side.RIGHT;
    else if (side === 'BOTTOM')
        return imports.gi.St.Side.BOTTOM;
    else if (side === 'LEFT')
        return imports.gi.St.Side.LEFT;
    else
        return imports.gi.St.Side.BOTTOM;
}
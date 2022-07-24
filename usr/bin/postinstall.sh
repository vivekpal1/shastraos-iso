#!/bin/bash

## Executes on live system

## Get mount points of target system according to installer being used (calamares or abif)
if [[ `pidof calamares` ]]; then
	chroot_path="/tmp/`lsblk | grep 'calamares-root' | awk '{ print $NF }' | sed -e 's/\/tmp\///' -e 's/\/.*$//' | tail -n1`"
else
	chroot_path='/mnt'
fi

if [[ "$chroot_path" == '/tmp/' ]] ; then
	echo "+---------------------->>"
    echo "[!] Fatal error: `basename $0`: chroot_path is empty!"
fi

## Use chroot not arch-chroot
arch_chroot() {
    chroot "$chroot_path" /bin/bash -c ${1}
}

## Detect drivers in use in live session
gpu_file="$chroot_path"/var/log/gpu-card-info.bash

_detect_vga_drivers() {
    local card=no
    local driver=no

    if [[ -n "`lspci -k | grep -P 'VGA|3D|Display' | grep -w "${2}"`" ]]; then
        card=yes
        if [[ -n "`lsmod | grep -w ${3}`" ]]; then
			driver=yes
		fi
        if [[ -n "`lspci -k | grep -wA2 "${2}" | grep 'Kernel driver in use: ${3}'`" ]]; then
			driver=yes
		fi
    fi
    echo "${1}_card=$card"     >> ${gpu_file}
    echo "${1}_driver=$driver" >> ${gpu_file}
}

echo "+---------------------->>"
echo "[*] Detecting GPU card & drivers used in live session..."

# Detect AMD
_detect_vga_drivers 'amd' 'AMD' 'amdgpu'

# Detect Intel
_detect_vga_drivers 'intel' 'Intel Corporation' 'i915'

# Detect Nvidia
_detect_vga_drivers 'nvidia' 'NVIDIA' 'nvidia'

# For logs
echo "+---------------------->>"
echo "[*] Content of $gpu_file :"
cat ${gpu_file}

# Remove unnecessary packages
_remove_unwanted_packages() {
    local _packages_to_remove=(
							   'calamares-config'
							   'calamares'
							   'archinstall'
							   'arch-install-scripts'
							   'ckbcomp'
							   'boost'
							   'mkinitcpio-archiso'
							   'darkhttpd'
							   'irssi'
							   'lftp'
							   'lynx'
							   'mc'
							   'ddrescue'
							   'testdisk'
							   'syslinux')
    local rpkg

	echo "+---------------------->>"
	echo "[*] Removing unnecessary packages..."
    for rpkg in "${_packages_to_remove[@]}"; do
		pacman -Q ${rpkg} &>/dev/null
		if [[ "$?" == 0 ]]; then
			pacman -Rnsc ${rpkg} --noconfirm
		fi
	done
}



## OTHER POST INSTALL

## -------- Remove VM Drivers --------------------

# Remove virtualbox pkgs if not running in vbox
_remove_vbox_pkgs() {
	local vbox_pkg='virtualbox-guest-utils'
	local vsrvfile='/etc/systemd/system/multi-user.target.wants/vboxservice.service'

    lspci | grep -i "virtualbox" >/dev/null
    if [[ "$?" != 0 ]] ; then
		echo "+---------------------->>"
		echo "[*] Removing $vbox_pkg from target system..."
		test -n "`pacman -Q $vbox_pkg 2>/dev/null`" && pacman -Rnsdd ${vbox_pkg} --noconfirm
		if [[ -L "$vsrvfile" ]] ; then
			rm -f "$vsrvfile"
		fi
    fi
}

# Remove vmware pkgs if not running in vmware
_remove_vmware_pkgs() {
    local vmware_pkgs=('open-vm-tools' 'xf86-input-vmmouse' 'xf86-video-vmware')
    local _vw_pkg

    lspci | grep -i "VMware" >/dev/null
    if [[ "$?" != 0 ]] ; then
		for _vw_pkg in "${vmware_pkgs[@]}" ; do
			echo "+---------------------->>"
			echo "[*] Removing ${_vw_pkg} from target system..."
			test -n "`pacman -Q ${_vw_pkg} 2>/dev/null`" && pacman -Rnsdd ${_vw_pkg} --noconfirm
		done
    fi
}

# Remove qemu guest pkg if not running in Qemu
_remove_qemu_pkgs() {
	local qemu_pkg='qemu-guest-agent'
	local qsrvfile='/etc/systemd/system/multi-user.target.wants/qemu-guest-agent.service'

    lspci -k | grep -i "qemu" >/dev/null
    if [[ "$?" != 0 ]] ; then
		echo "+---------------------->>"
		echo "[*] Removing $qemu_pkg from target system..."
		test -n "`pacman -Q $qemu_pkg 2>/dev/null`" && pacman -Rnsdd ${qemu_pkg} --noconfirm
		if [[ -L "$qsrvfile" ]] ; then
			rm -f "$qsrvfile"
		fi
    fi
}

## -------- Remove Un-wanted Drivers -------------
_remove_unwanted_graphics_drivers() {
	local gpu_file='/var/log/gpu-card-info.bash'

	local amd_card=''
	local amd_driver=''
	local intel_card=''
	local intel_driver=''
	local nvidia_card=''
	local nvidia_driver=''

	if [[ -r "$gpu_file" ]] ; then
		echo "+---------------------->>"
		echo "[*] Getting drivers info from $gpu_file file..."
		source ${gpu_file}
	else
		echo "+---------------------->>"
		echo "[!] Warning: file $gpu_file does not exist!"
	fi

	# Remove AMD drivers
    if [[ -n "`lspci -k | grep 'Advanced Micro Devices'`" ]] ; then
        amd_card=yes
    elif [[ -n "`lspci -k | grep 'AMD/ATI'`" ]] ; then
        amd_card=yes
    elif [[ -n "`lspci -k | grep 'Radeon'`" ]] ; then
        amd_card=yes
    fi
    echo "+---------------------->>"
    echo "[*] AMD Card : $amd_card"
	if [[ "$amd_card" == 'no' ]] ; then
		echo "[*] Removing AMD drivers from target system..."
        _remove_pkgs_if_installed xf86-video-amdgpu xf86-video-ati
	fi

	# Remove intel drivers
	echo "+---------------------->>"
    echo "[*] Intel Card : $intel_card"
	if [[ "$intel_card" == 'no' ]] ; then
		echo "[*] Removing Intel drivers from target system..."
        _remove_pkgs_if_installed xf86-video-intel
	fi

	# Remove All nvidia drivers
	echo "+---------------------->>"
    echo "[*] Nvidia Card : $nvidia_card"
	if [[ "$nvidia_card" == 'no' ]] ; then
		echo "[*] Removing All Nvidia drivers from target system..."
        _remove_pkgs_if_installed xf86-video-nouveau nvidia nvidia-settings nvidia-utils
	fi

	# Remove nvidia drivers
	echo "+---------------------->>"
    echo "[*] Nvidia Drivers : $nvidia_driver"
	if [[ "$nvidia_driver" == 'no' ]] ; then
		echo "[*] Removing Nvidia drivers from target system..."
        _remove_pkgs_if_installed nvidia nvidia-settings nvidia-utils
	fi

	# Remove nouveau drivers
	echo "+---------------------->>"
    echo "[*] Free Nvidia Drivers : $nvidia_driver"
	if [[ "$nvidia_driver" == 'yes' ]] ; then
		echo "[*] Removing open-source Nvidia drivers from target system..."
        _remove_pkgs_if_installed xf86-video-nouveau
	fi
}

## -------- Remove Un-wanted Ucode ---------------

# Remove un-wanted ucode package
_remove_unwanted_ucode() {
	cpu="`grep -w "^vendor_id" /proc/cpuinfo | head -n 1 | awk '{print $3}'`"
	
	case "$cpu" in
		GenuineIntel)	echo "+---------------------->>" && echo "[*] Removing amd-ucode from target system..."
						_remove_pkgs_if_installed amd-ucode
						;;
		*)            	echo "+---------------------->>" && echo "[*] Removing intel-ucode from target system..."
						_remove_pkgs_if_installed intel-ucode
						;;
	esac
}


## -------- Delete Unnecessary Files -------------

# Clean live ISO stuff from target system
_clean_target_system() {
    local _files_to_remove=(
        /etc/sudoers.d/02_g_wheel
        /etc/systemd/system/{etc-pacman.d-gnupg.mount,getty@tty1.service.d}
        /etc/systemd/system/getty@tty1.service.d/autologin.conf
        /etc/initcpio
        /etc/mkinitcpio-archiso.conf
        /etc/polkit-1/rules.d/49-nopasswd-calamares.rules
        /etc/{group-,gshadow-,passwd-,shadow-}
        /etc/udev/rules.d/81-dhcpcd.rules
        /etc/skel/{.xinitrc,.xsession,.xprofile}
        /home/"$new_user"/{.xinitrc,.xsession,.xprofile,.wget-hsts,.screenrc,.ICEauthority}
        /root/{.automated_script.sh,.zlogin}
        /root/{.xinitrc,.xsession,.xprofile}
		/usr/local/bin/{Installation_guide}
		/usr/share/applications/xfce4-about.desktop
		/usr/share/calamares
        /{gpg.conf,gpg-agent.conf,pubring.gpg,secring.gpg}
        /var/lib/NetworkManager/NetworkManager.state
    )
    local dfile

	echo "+---------------------->>"
	echo "[*] Deleting live ISO files..."
    for dfile in "${_files_to_remove[@]}"; do 
		rm -rf ${dfile}
	done
    find /usr/lib/initcpio -name archiso* -type f -exec rm '{}' \;
}

## -------- Perform Misc Operations --------------

_perform_various_stuff() {

	# Copy grub theme to boot directory
	echo "+---------------------->>"
	echo "[*] Copying grub theme to boot directory..."
	mkdir -p /boot/grub/themes
	cp -rf /usr/share/grub/themes/shastraos /boot/grub/themes

	# disabling autologin for lightdm (if exist)
	lightdm_config='/etc/lightdm/lightdm.conf'
	if [[ -e "$lightdm_config" ]]; then
		echo "+---------------------->>"
		echo "[*] Disabling autologin for lightdm..."
		sed -i -e 's|autologin-user=.*|#autologin-user=username|g' "$lightdm_config"
		sed -i -e 's|autologin-session=.*|#autologin-session=openbox|g' "$lightdm_config"
	fi

	# disabling autologin for lxdm (if exist)
	lxdm_config='/etc/lxdm/lxdm.conf'
	if [[ -e "$lxdm_config" ]]; then
		echo "+---------------------->>"
		echo "[*] Disabling autologin for lxdm..."
		sed -i -e 's/autologin=.*/#autologin=username/g' "$lxdm_config"
	fi

	# disabling autologin for sddm (if exist)
	sddm_config='/etc/sddm.conf.d/kde_settings.conf'
	if [[ -e "$sddm_config" ]]; then
		echo "+---------------------->>"
		echo "[*] Disabling autologin for sddm..."
		sed -i -e 's/User=.*/#User=username/g' "$sddm_config"
	fi

	# Fix btrfs disk IO on kernel 5.16.x
	fstab_file='/etc/fstab'
	if [[ `uname -r` == 5.16.* ]]; then
		echo "+---------------------->>"
		echo -e "Kernel Version : `uname -r`"
		cat "$fstab_file" | grep 'btrfs' &>/dev/null
		if [[ "$?" == 0 ]] ; then
			echo -e "Filesystem Type : btrfs"
			echo -e "Fixing 'large amount of disk IO in btrfs' issue for kernel version : `uname -r`"
			sed -i -e 's/,autodefrag/,noautodefrag/g' "$fstab_file"
			echo -e "\n# btrfs disk IO fix by replacing 'autodefrag' by 'noautodefrag' for kernel version : `uname -r`" >> "$fstab_file"
		fi
	fi

	# Perform various operations
	echo "+---------------------->>"
	echo "[*] Running operations as new user : ${new_user}..."
    [[ -x `which archcraft-hooks-runner` ]] && archcraft-hooks-runner
	runuser -l ${new_user} -c 'xdg-user-dirs-update'
	runuser -l ${new_user} -c 'xdg-user-dirs-gtk-update'

    # Journal stuff
    sed -i 's/volatile/auto/g' /etc/systemd/journald.conf 2>>/tmp/.errlog
    sed -i 's/.*pam_wheel\.so/#&/' /etc/pam.d/su	
}

## -------- ## Execute Script ## -----------------
_manage_systemd_services
_remove_vbox_pkgs
_remove_vmware_pkgs
_remove_qemu_pkgs
_remove_unwanted_graphics_drivers
_remove_unwanted_ucode
_remove_unwanted_packages
_clean_target_system
_perform_various_stuff


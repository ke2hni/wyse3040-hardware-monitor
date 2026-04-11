# Wyse 3040 Hardware Monitor (Cockpit Plugin)

Hardware monitoring plugin for the Dell Wyse 3040 Thin Client, built for Cockpit.

Displays real-time system data including temperatures, storage, load, and system status with dynamic color indicators.

## Supported Hardware

- Dell Wyse 3040 Thin Client

The installer verifies the hardware before installing.

## Quick Install (Recommended)

Clone the repo and run the installer:

```bash
git clone https://github.com/ke2hni/wyse3040-hardware-monitor.git
cd wyse3040-hardware-monitor
sudo ./install.sh
```

The installer will:
- verify system compatibility
- install required dependencies if missing
- build the plugin
- install the plugin into Cockpit

After install:
- refresh your browser, or
- reboot if it does not appear

## Manual Install

If you prefer not to use the installer:

```bash
make
sudo mkdir -p /usr/local/share/cockpit/wyse3040-monitor
sudo cp -r dist/* /usr/local/share/cockpit/wyse3040-monitor/
```

Then refresh Cockpit or reboot.

## Removal / Uninstall

To remove the plugin:

```bash
sudo rm -rf /usr/local/share/cockpit/wyse3040-monitor
'''

## Features

- Live CPU / SoC temperature monitoring
- Dynamic color-changing borders based on thermal thresholds
- Storage detection with readable size formatting
- System load monitoring
- Fully compatible with Cockpit Default / Light / Dark themes
- Designed specifically for Wyse 3040 hardware

## Notes

- This plugin is hardware-specific and will not install on unsupported systems
- Uses a simple direct-install method (no RPM packaging required)
- Does not modify or restart Cockpit services

## Development (Optional)

For development use:

```bash
make
mkdir -p ~/.local/share/cockpit
ln -s $(pwd)/dist ~/.local/share/cockpit/wyse3040-monitor
```

## Removal / Uninstall

For development use:
To remove the plugin:

```bash
sudo rm -f ~/.local/share/cockpit/wyse3040-monitor
'''

## Status

Stable and tested:
- survives reboot
- live data working
- UI fully functional
- lint checks passing

<img width="1600" height="900" alt="Screenshot 2026-04-11 160543" src="https://github.com/user-attachments/assets/da683132-c9e3-4b1b-92c2-4bdccc3119fb" />
<img width="1600" height="900" alt="Screenshot 2026-04-11 160601" src="https://github.com/user-attachments/assets/3ab737fd-4b1a-4bca-aed2-b5aa6044bfcf" />

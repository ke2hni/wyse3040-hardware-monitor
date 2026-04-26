# Wyse 3040 Hardware Monitor (Cockpit Plugin)

![Platform](https://img.shields.io/badge/Platform-Raspberry%20Pi%205-blue)
![Cockpit](https://img.shields.io/badge/Cockpit-Plugin-green)
![Status](https://img.shields.io/badge/Status-Stable-brightgreen)
![AllStarLink](https://img.shields.io/badge/AllStarLink%203-Compatible-purple)

Hardware monitoring plugin for the Dell Wyse 3040 Thin Client, built for Cockpit.

Displays real-time system data including temperatures, storage, system load, and overall status with dynamic visual indicators.

---

## 🚀 Install (Recommended)

```bash
sudo apt update
sudo apt install -y git
git clone https://github.com/ke2hni/wyse3040-hardware-monitor.git
cd wyse3040-hardware-monitor
sudo ./install.sh
```

The installer will:
- verify hardware compatibility (Wyse 3040 only)
- install required dependencies (if missing)
- build the plugin
- install it into Cockpit

After install:
- refresh your browser
or
- reboot if it does not appear

---

## 🔄 Upgrade

```bash
cd ~/wyse3040-hardware-monitor
git pull
sudo ./install.sh
```

---

## 🗑️ Uninstall

```bash
sudo rm -rf /usr/local/share/cockpit/wyse3040-monitor
```

---

## ⚙️ Features

- Live CPU / SoC temperature monitoring
- Dynamic color-coded thermal status (Cool / Normal / Warm / Hot)
- Storage detection with readable size formatting
- System load monitoring
- Clean UI compatible with Cockpit Default / Light / Dark themes
- Designed specifically for Wyse 3040 hardware

---

## 🖥️ Supported Hardware

- Dell Wyse 3040 Thin Client

The installer will prevent installation on unsupported systems.

---

## 📝 Notes

- No background services are installed
- Does not modify or restart Cockpit services
- Uses a simple direct-install method (no packaging required)

---

## 🛠️ Manual Install (Optional)

```bash
make
sudo mkdir -p /usr/local/share/cockpit/wyse3040-monitor
sudo cp -r dist/* /usr/local/share/cockpit/wyse3040-monitor/
```

Then refresh Cockpit or reboot.

---

## 🧪 Development (Optional)

```bash
make
mkdir -p ~/.local/share/cockpit
ln -s $(pwd)/dist ~/.local/share/cockpit/wyse3040-monitor
```

To remove dev install:

```bash
rm -f ~/.local/share/cockpit/wyse3040-monitor
```

---

## 📊 Status

Stable and tested:
- survives reboot
- live data working
- UI fully functional
- lint checks passing

---

## 📸 Screenshots

![Screenshot](https://github.com/user-attachments/assets/da683132-c9e3-4b1b-92c2-4bdccc3119fb)

![Screenshot](https://github.com/user-attachments/assets/3ab737fd-4b1a-4bca-aed2-b5aa6044bfcf)

#!/usr/bin/env bash
set -euo pipefail

PLUGIN_NAME="wyse3040-monitor"
INSTALL_DIR="/usr/local/share/cockpit/${PLUGIN_NAME}"
REQUIRED_PACKAGES=(dmidecode git make nodejs npm)

if [[ "${EUID}" -ne 0 ]]; then
    echo "Please run this installer with sudo or as root."
    exit 1
fi

if ! command -v apt-get >/dev/null 2>&1; then
    echo "This installer currently supports Debian/apt-based systems only."
    exit 1
fi

if ! command -v dmidecode >/dev/null 2>&1; then
    echo "dmidecode is required for hardware verification."
    echo "Installing dmidecode..."
    apt-get update
    apt-get install -y dmidecode
fi

manufacturer="$(dmidecode -s system-manufacturer 2>/dev/null | tr -d '\r')"
product_name="$(dmidecode -s system-product-name 2>/dev/null | tr -d '\r')"

if [[ "${manufacturer}" != "Dell Inc." || "${product_name}" != "Wyse 3040 Thin Client" ]]; then
    echo "Unsupported system."
    echo "Detected manufacturer: ${manufacturer:-unknown}"
    echo "Detected product: ${product_name:-unknown}"
    echo "This plugin installer supports only the Dell Wyse 3040 Thin Client."
    exit 1
fi

missing_packages=()
for pkg in "${REQUIRED_PACKAGES[@]}"; do
    if ! dpkg -s "${pkg}" >/dev/null 2>&1; then
        missing_packages+=("${pkg}")
    fi
done

if (( ${#missing_packages[@]} > 0 )); then
    echo "Installing missing packages: ${missing_packages[*]}"
    apt-get update
    apt-get install -y "${missing_packages[@]}"
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

echo "Building ${PLUGIN_NAME}..."
make

if [[ ! -d dist ]]; then
    echo "Build did not produce a dist/ directory."
    exit 1
fi

echo "Installing ${PLUGIN_NAME} to ${INSTALL_DIR}..."
mkdir -p "${INSTALL_DIR}"
cp -r dist/* "${INSTALL_DIR}/"

echo
echo "Install complete."
echo "Refresh your browser to reload Cockpit."
echo "If the plugin does not appear, reboot the system."

/*
 * SPDX-License-Identifier: LGPL-2.1-or-later
 *
 * Copyright (C) 2026 Jeff Milne - KE2HNI
 */
import React, { useEffect, useState } from 'react';
import cockpit from "cockpit";
/* import "./app.scss";
 */

/*
 * Main Cockpit/React UI dependencies reused from the Pi 5 monitor layout.
 */
import { Card, CardBody } from "@patternfly/react-core/dist/esm/components/Card/index.js";
import { Content, ContentVariants } from "@patternfly/react-core/dist/esm/components/Content/index.js";
import { MenuToggle } from "@patternfly/react-core/dist/esm/components/MenuToggle/index.js";
import { Page, PageSection } from "@patternfly/react-core/dist/esm/components/Page/index.js";
import { Select, SelectList, SelectOption } from "@patternfly/react-core/dist/esm/components/Select/index.js";
import { Title } from "@patternfly/react-core/dist/esm/components/Title/index.js";
import { Flex, FlexItem } from "@patternfly/react-core/dist/esm/layouts/Flex/index.js";
import { Gallery } from "@patternfly/react-core/dist/esm/layouts/Gallery/index.js";

/*
 * Live thermal readings exposed by the Wyse 3040 on Debian 13.
 */
type ThermalState = {
    core0: string;
    core1: string;
    core2: string;
    core3: string;
    soc1: string;
    soc2: string;
    platform: string;
};

/*
 * General live system summary values shown in the System Summary section.
 */
type SystemState = {
    model: string;
    cpuModel: string;
    cpuFrequency: string;
    totalRam: string;
    usedRam: string;
    memoryUsage: string;
    uptime: string;
    kernel: string;
    loadAverage: string;
    rootFilesystemUsed: string;
};

/*
 * Boot and device-identification values for the node.
 */
type BootState = {
    bootDevice: string;
    rootDevice: string;
    usbStoragePresent: string;
};

/*
 * Root filesystem summary cards.
 */
type RootStorageState = {
    device: string;
    mountedAt: string;
    size: string;
    used: string;
    free: string;
    usedPercent: string;
};

/*
 * External USB storage summary cards, shown only when a USB disk is present.
 */
type UsbStorageState = {
    present: string;
    model: string;
    capacity: string;
    freeSpace: string;
    devicePath: string;
    mountedAt: string;
};

type UsbDevice = {
    name: string;
    model: string;
    size: string;
    mountpoint: string;
    fstype: string;
};

/*
 * Combined monitor state used by the page.
 */
type MonitorState = {
    thermal: ThermalState;
    system: SystemState;
    boot: BootState;
    rootStorage: RootStorageState;
    usbStorage: UsbStorageState;
};

/*
 * Section visibility keys used by the Show/Hide Sections control.
 */
type SectionKey =
    | "thermal"
    | "system"
    | "boot"
    | "rootStorage"
    | "usbStorage";

/*
 * Human-readable section labels shown in the visibility dropdown.
 */
const SECTION_LABELS: Record<SectionKey, string> = {
    thermal: "Thermal / Cooling",
    system: "System Summary",
    boot: "Boot / Device Info",
    rootStorage: "Root Storage",
    usbStorage: "External USB Storage",
};

/*
 * Default visible state for each major page section.
 */
const DEFAULT_VISIBLE_SECTIONS: Record<SectionKey, boolean> = {
    thermal: true,
    system: true,
    boot: true,
    rootStorage: true,
    usbStorage: true,
};

/*
 * localStorage key used to persist section visibility across refresh/reboot.
 */
const SECTION_STORAGE_KEY = "wyse3040-monitor-visible-sections";

/*
 * UI formatting and status helper functions.
 */
function parseTempC(tempText: string) {
    const match = tempText.match(/([-+]?\d+(?:\.\d+)?)\s*°C/);
    return match ? Number(match[1]) : NaN;
}

function getTempStatusClass(tempText: string) {
    const tempC = parseTempC(tempText);

    if (!Number.isFinite(tempC)) return "";

    if (tempC < 55) return "pi-card-status-info";
    if (tempC < 65) return "pi-card-status-success";
    if (tempC < 80) return "pi-card-status-warning";
    return "pi-card-status-danger";
}

function getIoTempStatusClass(tempText: string) {
    const tempC = parseTempC(tempText);

    if (!Number.isFinite(tempC)) return "";

    if (tempC < 45) return "pi-card-status-info";
    if (tempC < 65) return "pi-card-status-success";
    if (tempC < 80) return "pi-card-status-warning";
    return "pi-card-status-danger";
}

function formatTemp(raw: string) {
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) return "--";
    const c = n / 1000;
    const f = (c * 9 / 5) + 32;
    return `${c.toFixed(1)} °C / ${f.toFixed(1)} °F`;
}

function formatBytesDecimal(bytes: string | number) {
    const n = Number(bytes);
    if (!Number.isFinite(n) || n <= 0) return "--";

    const units = ["B", "KB", "MB", "GB", "TB", "PB"];
    let value = n;
    let unit = 0;

    while (value >= 1000 && unit < units.length - 1) {
        value /= 1000;
        unit += 1;
    }

    return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function formatBytesGiB(bytes: string | number) {
    const n = Number(bytes);
    if (!Number.isFinite(n) || n <= 0) return "--";
    return `${(n / (1024 ** 3)).toFixed(1)} GiB`;
}

function formatMemUsage(usedBytes: string | number, totalBytes: string | number) {
    const used = Number(usedBytes);
    const total = Number(totalBytes);

    if (!Number.isFinite(used) || !Number.isFinite(total) || total <= 0) return "--";
    return `${Math.round((used / total) * 100)}%`;
}

function formatCpuFreq(rawKHz: string) {
    const n = Number(rawKHz);
    if (!Number.isFinite(n) || n <= 0) return "--";

    const mhz = n / 1000;
    if (mhz >= 1000) return `${(mhz / 1000).toFixed(2)} GHz`;
    return `${mhz.toFixed(0)} MHz`;
}

function formatUptime(secondsRaw: string) {
    const seconds = Math.floor(Number(secondsRaw));
    if (!Number.isFinite(seconds)) return "--";

    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);

    const parts: string[] = [];
    if (days) parts.push(`${days}d`);
    if (hours || days) parts.push(`${hours}h`);
    parts.push(`${mins}m`);

    return parts.join(" ");
}

function classifyBootDevice(rootDevice: string) {
    if (!rootDevice || rootDevice === "--") return "--";
    if (rootDevice.startsWith("/dev/mmcblk")) return "eMMC / flash";
    if (rootDevice.startsWith("/dev/sd")) return "USB / SATA";
    if (rootDevice.startsWith("/dev/nvme")) return "NVMe";
    return "Other";
}

/*
 * Safe default values before the first live refresh finishes.
 */
function defaultMonitorState(): MonitorState {
    return {
        thermal: {
            core0: "--",
            core1: "--",
            core2: "--",
            core3: "--",
            soc1: "--",
            soc2: "--",
            platform: "--",
        },
        system: {
            model: "--",
            cpuModel: "--",
            cpuFrequency: "--",
            totalRam: "--",
            usedRam: "--",
            memoryUsage: "--",
            uptime: "--",
            kernel: "--",
            loadAverage: "--",
            rootFilesystemUsed: "--",
        },
        boot: {
            bootDevice: "--",
            rootDevice: "--",
            usbStoragePresent: "--",
        },
        rootStorage: {
            device: "--",
            mountedAt: "--",
            size: "--",
            used: "--",
            free: "--",
            usedPercent: "--",
        },
        usbStorage: {
            present: "--",
            model: "--",
            capacity: "--",
            freeSpace: "--",
            devicePath: "--",
            mountedAt: "--",
        },
    };
}

/*
 * Helper used by the live reader to run local commands through Cockpit.
 */
async function run(command: string): Promise<string> {
    const proc = cockpit.spawn(["bash", "-lc", command], { superuser: "try" });
    return await proc.then((data: string) => data.trim());
}

function parseTemps(thermalText: string, coreText: string): ThermalState {
    const zoneMap: Record<string, string> = {
        PNIT: "--",
        soc_dts0: "--",
        soc_dts1: "--",
    };

    for (const line of thermalText.split("\n")) {
        const parts = line.split("|");
        if (parts.length !== 2) continue;

        const name = parts[0].trim();
        const value = parts[1].trim();

        if (name === "PNIT") zoneMap.PNIT = formatTemp(value);
        if (name === "soc_dts0") zoneMap.soc_dts0 = formatTemp(value);
        if (name === "soc_dts1") zoneMap.soc_dts1 = formatTemp(value);
    }

    const coreMap: Record<string, string> = {
        "Core 0": "--",
        "Core 1": "--",
        "Core 2": "--",
        "Core 3": "--",
    };

    for (const line of coreText.split("\n")) {
        const parts = line.split("|");
        if (parts.length !== 2) continue;

        const label = parts[0].trim();
        const value = parts[1].trim();

        if (label in coreMap) {
            coreMap[label] = formatTemp(value);
        }
    }

    return {
        core0: coreMap["Core 0"],
        core1: coreMap["Core 1"],
        core2: coreMap["Core 2"],
        core3: coreMap["Core 3"],
        soc1: zoneMap.soc_dts0,
        soc2: zoneMap.soc_dts1,
        platform: zoneMap.PNIT,
    };
}

function parseUsbDevices(lsblkJson: string): UsbDevice[] {
    try {
        const parsed = JSON.parse(lsblkJson);
        const devices = parsed.blockdevices || [];
        const usbDevices: UsbDevice[] = [];

        for (const dev of devices) {
            if (dev.type !== "disk" || dev.tran !== "usb") {
                continue;
            }

            const children = dev.children || [];
            if (children.length > 0) {
                for (const child of children) {
                    usbDevices.push({
                        name: child.name || dev.name || "Unknown",
                        model: dev.model || "Unknown",
                        size: child.size || dev.size || "Unknown",
                        mountpoint: child.mountpoint || "",
                        fstype: child.fstype || "",
                    });
                }
            } else {
                usbDevices.push({
                    name: dev.name || "Unknown",
                    model: dev.model || "Unknown",
                    size: dev.size || "Unknown",
                    mountpoint: dev.mountpoint || "",
                    fstype: dev.fstype || "",
                });
            }
        }

        return usbDevices;
    } catch {
        return [];
    }
}

async function readFastMonitorData(currentUsb: UsbStorageState): Promise<MonitorState> {
    const [
        model,
        cpuModel,
        cpuFreqRaw,
        kernel,
        uptimeRaw,
        loadavg,
        meminfo,
        rootDf,
        rootDevice,
        thermalZones,
        coreTemps,
    ] = await Promise.all([
        run("cat /sys/devices/virtual/dmi/id/product_name 2>/dev/null || echo --"),
        run("awk -F': ' '/model name/ {print $2; exit}' /proc/cpuinfo"),
        run("cat /sys/devices/system/cpu/cpu0/cpufreq/scaling_cur_freq 2>/dev/null || echo --"),
        run("uname -r"),
        run("cut -d. -f1 /proc/uptime"),
        run("cut -d' ' -f1-3 /proc/loadavg"),
        run("cat /proc/meminfo"),
        run("df -B1 / --output=source,size,used,avail,pcent,target | tail -n 1"),
        run("findmnt -n -o SOURCE /"),
        run("for z in /sys/class/thermal/thermal_zone*; do printf '%s|' \"$(cat \"$z/type\" 2>/dev/null)\"; cat \"$z/temp\" 2>/dev/null; done"),
        run("for f in /sys/class/hwmon/hwmon*/temp*_label; do [ -r \"$f\" ] || continue; label=$(cat \"$f\" 2>/dev/null); case \"$label\" in 'Core 0'|'Core 1'|'Core 2'|'Core 3') base=$(printf '%s\\n' \"$f\" | sed 's/_label$//'); printf '%s|' \"$label\"; cat \"$base\"_input 2>/dev/null ;; esac; done"),
    ]);

    const memTotalLine = meminfo.split("\n").find(line => line.startsWith("MemTotal:"));
    const memAvailableLine = meminfo.split("\n").find(line => line.startsWith("MemAvailable:"));
    const memTotalKb = memTotalLine ? Number(memTotalLine.replace(/[^\d]/g, "")) : NaN;
    const memAvailableKb = memAvailableLine ? Number(memAvailableLine.replace(/[^\d]/g, "")) : NaN;
    const memTotalBytes = memTotalKb * 1024;
    const memUsedBytes = Number.isFinite(memTotalKb) && Number.isFinite(memAvailableKb)
        ? Math.max(0, (memTotalKb - memAvailableKb) * 1024)
        : NaN;

    const rootParts = rootDf.split(/\s+/);
    const rootSize = rootParts[1] || "";
    const rootUsed = rootParts[2] || "";
    const rootFree = rootParts[3] || "";
    const rootPercent = rootParts[4] || "";
    const rootMount = rootParts[5] || "/";

    return {
        thermal: parseTemps(thermalZones, coreTemps),
        system: {
            model: model || "--",
            cpuModel: cpuModel || "--",
            cpuFrequency: formatCpuFreq(cpuFreqRaw || ""),
            totalRam: formatBytesGiB(memTotalBytes),
            usedRam: formatBytesGiB(memUsedBytes),
            memoryUsage: formatMemUsage(memUsedBytes, memTotalBytes),
            uptime: formatUptime(uptimeRaw || ""),
            kernel: kernel || "--",
            loadAverage: loadavg || "--",
            rootFilesystemUsed: rootPercent || "--",
        },
        boot: {
            bootDevice: classifyBootDevice(rootDevice || "--"),
            rootDevice: rootDevice || "--",
            usbStoragePresent: currentUsb.present,
        },
        rootStorage: {
            device: rootDevice || "--",
            mountedAt: rootMount || "--",
            size: formatBytesDecimal(rootSize || ""),
            used: formatBytesDecimal(rootUsed || ""),
            free: formatBytesDecimal(rootFree || ""),
            usedPercent: rootPercent || "--",
        },
        usbStorage: currentUsb,
    };
}

async function readUsbStorageData(): Promise<UsbStorageState> {
    const lsblkJson = await run("lsblk -b -J -o NAME,MODEL,SIZE,TYPE,TRAN,MOUNTPOINT,FSTYPE");
    const usbDevices = parseUsbDevices(lsblkJson);
    const first = usbDevices[0];

    if (!first) {
        return {
            present: "No",
            model: "--",
            capacity: "--",
            freeSpace: "--",
            devicePath: "--",
            mountedAt: "--",
        };
    }

    let freeSpace = "--";
    if (first.mountpoint) {
        try {
            const freeBytes = await run(`df -B1 "${first.mountpoint}" | awk 'NR==2 {print $4}'`);
            freeSpace = formatBytesDecimal(freeBytes || "");
        } catch {
            freeSpace = "--";
        }
    }

    return {
        present: "Yes",
        model: first.model || "--",
        capacity: formatBytesDecimal(first.size || ""),
        freeSpace,
        devicePath: first.name ? `/dev/${first.name}` : "--",
        mountedAt: first.mountpoint || "--",
    };
}

/*
 * Main Wyse 3040 monitor page.
 * Keeps the Pi-style layout, status colors, and fast refresh feel,
 * but uses the simpler proven live-data backend.
 */
export const Application = () => {
    const [liveDataOnline, setLiveDataOnline] = useState(false);
    const [monitor, setMonitor] = useState<MonitorState>(defaultMonitorState());
    const [isSectionsOpen, setIsSectionsOpen] = useState(false);
    const [visibleSections, setVisibleSections] =
        useState<Record<SectionKey, boolean>>(() => {
            try {
                const raw = window.localStorage.getItem(SECTION_STORAGE_KEY);
                if (!raw) return DEFAULT_VISIBLE_SECTIONS;

                const parsed = JSON.parse(raw) as Partial<Record<SectionKey, boolean>>;
                return { ...DEFAULT_VISIBLE_SECTIONS, ...parsed };
            } catch {
                return DEFAULT_VISIBLE_SECTIONS;
            }
        });

    /*
     * Fast live refresh loop for temps/system/root, slower loop for USB inventory.
     */
    useEffect(() => {
        let cancelled = false;
        let lastSnapshot = "";
        let stallTimer: number | undefined;
        let usbState: UsbStorageState = defaultMonitorState().usbStorage;

        const markOnline = () => {
            if (cancelled) return;
            setLiveDataOnline(true);

            if (stallTimer !== undefined) {
                window.clearTimeout(stallTimer);
            }

            stallTimer = window.setTimeout(() => {
                if (!cancelled) {
                    setLiveDataOnline(false);
                }
            }, 2500);
        };

        const fastLoop = async (): Promise<void> => {
            try {
                const data = await readFastMonitorData(usbState);
                if (cancelled) return;

                const snapshot = JSON.stringify(data);
                if (snapshot !== lastSnapshot) {
                    lastSnapshot = snapshot;
                    setMonitor(data);
                }

                markOnline();

                window.setTimeout(() => {
                    if (!cancelled) {
                        fastLoop().catch(() => undefined);
                    }
                }, 250);
            } catch {
                if (cancelled) return;

                setLiveDataOnline(false);

                window.setTimeout(() => {
                    if (!cancelled) {
                        fastLoop().catch(() => undefined);
                    }
                }, 1000);
            }
        };

        const usbLoop = async (): Promise<void> => {
            try {
                usbState = await readUsbStorageData();
                if (cancelled) return;

                setMonitor(prev => ({
                    ...prev,
                    boot: {
                        ...prev.boot,
                        usbStoragePresent: usbState.present,
                    },
                    usbStorage: usbState,
                }));
            } catch {
                // keep prior USB state on errors
            }

            window.setTimeout(() => {
                if (!cancelled) {
                    usbLoop().catch(() => undefined);
                }
            }, 5000);
        };

        usbLoop().catch(() => undefined);
        fastLoop().catch(() => undefined);

        return () => {
            cancelled = true;
            if (stallTimer !== undefined) {
                window.clearTimeout(stallTimer);
            }
        };
    }, []);

    /*
     * Persist the Show/Hide Sections choices in browser local storage.
     */
    useEffect(() => {
        try {
            window.localStorage.setItem(
                SECTION_STORAGE_KEY,
                JSON.stringify(visibleSections)
            );
        } catch {
            // ignore storage failures
        }
    }, [visibleSections]);

    /*
     * External USB Storage section only shows when a USB disk is really present.
     */
    const showUsbStorageSection = monitor.usbStorage.present === "Yes";

    return (
        <Page className="pf-m-no-sidebar ct-content-gap">
            <PageSection variant="secondary" isFilled>
                <Card isPlain className="pi-card-service-like">
                    <CardBody>
                        {/* Page header row with title, live status card, and section chooser. */}
                        <Flex
                            justifyContent={{ default: "justifyContentSpaceBetween" }}
                            alignItems={{ default: "alignItemsFlexStart" }}
                        >
                            <FlexItem flex={{ default: "flex_1" }}>
                                <Title headingLevel="h1">Dell Wyse 3040 Hardware Monitor</Title>
                                <Content component={ContentVariants.p}>
                                    Ver. 1.4 - April 2026
                                </Content>
                            </FlexItem>

                            <FlexItem>
                                <Card
                                    isCompact
                                    className={`pi-live-data-card ${liveDataOnline ? "pi-live-data-card-online" : "pi-live-data-card-offline"}`}
                                >
                                    <CardBody>
                                        <Title headingLevel="h3">
                                            <span>Live Sensor Data</span>
                                            <br />
                                            <span>{liveDataOnline ? "Online" : "Offline"}</span>
                                        </Title>
                                    </CardBody>
                                </Card>
                            </FlexItem>

                            <FlexItem flex={{ default: "flex_1" }}>
                                <Flex
                                    direction={{ default: "column" }}
                                    spaceItems={{ default: "spaceItemsSm" }}
                                    alignItems={{ default: "alignItemsFlexEnd" }}
                                >
                                    <FlexItem>
                                        <Select
                                            isOpen={isSectionsOpen}
                                            onOpenChange={setIsSectionsOpen}
                                            popperProps={{
                                                direction: "down",
                                                position: "right",
                                                enableFlip: true,
                                                preventOverflow: true,
                                            }}
                                            onSelect={(_, value) => {
                                                const key = value as SectionKey;

                                                setVisibleSections(prev => ({
                                                    ...prev,
                                                    [key]: !prev[key],
                                                }));
                                            }}
                                            selected={Object.keys(visibleSections).filter(
                                                key => visibleSections[key as SectionKey]
                                            )}
                                            role="menu"
                                            toggle={(toggleRef) => (
                                                <MenuToggle
                                                    ref={toggleRef}
                                                    onClick={() => setIsSectionsOpen(prev => !prev)}
                                                    isExpanded={isSectionsOpen}
                                                >
                                                    Show/Hide Sections
                                                </MenuToggle>
                                            )}
                                        >
                                            <SelectList>
                                                {(Object.keys(SECTION_LABELS) as SectionKey[]).map((key) => (
                                                    <SelectOption
                                                        key={key}
                                                        value={key}
                                                        hasCheckbox
                                                        isSelected={visibleSections[key]}
                                                    >
                                                        {SECTION_LABELS[key]}
                                                    </SelectOption>
                                                ))}
                                            </SelectList>
                                        </Select>
                                    </FlexItem>
                                </Flex>
                            </FlexItem>
                        </Flex>

                        {/* Thermal / Cooling section: live temperature cards with status-color borders. */}
                        {visibleSections.thermal && (
                            <>
                                <Content>
                                    <Title headingLevel="h2">Thermal / Cooling</Title>
                                    <Content component={ContentVariants.small}>
                                        CPU core and chipset thermal readings. Border color guide: Blue = Cool · Green = Normal · Yellow = Warm · Red = Hot
                                    </Content>
                                </Content>
                                <Gallery hasGutter minWidths={{ default: "220px" }}>
                                    <Card isCompact className={getTempStatusClass(monitor.thermal.core0)}>
                                        <CardBody>
                                            <Title headingLevel="h4" size="md" className="pi-card-label">Core 0</Title>
                                            <Title headingLevel="h3">{monitor.thermal.core0}</Title>
                                        </CardBody>
                                    </Card>
                                    <Card isCompact className={getTempStatusClass(monitor.thermal.core1)}>
                                        <CardBody>
                                            <Title headingLevel="h4" size="md" className="pi-card-label">Core 1</Title>
                                            <Title headingLevel="h3">{monitor.thermal.core1}</Title>
                                        </CardBody>
                                    </Card>
                                    <Card isCompact className={getTempStatusClass(monitor.thermal.core2)}>
                                        <CardBody>
                                            <Title headingLevel="h4" size="md" className="pi-card-label">Core 2</Title>
                                            <Title headingLevel="h3">{monitor.thermal.core2}</Title>
                                        </CardBody>
                                    </Card>
                                    <Card isCompact className={getTempStatusClass(monitor.thermal.core3)}>
                                        <CardBody>
                                            <Title headingLevel="h4" size="md" className="pi-card-label">Core 3</Title>
                                            <Title headingLevel="h3">{monitor.thermal.core3}</Title>
                                        </CardBody>
                                    </Card>
                                    <Card isCompact className={getIoTempStatusClass(monitor.thermal.soc1)}>
                                        <CardBody>
                                            <Title headingLevel="h4" size="md" className="pi-card-label">SoC Temp 1</Title>
                                            <Title headingLevel="h3">{monitor.thermal.soc1}</Title>
                                        </CardBody>
                                    </Card>
                                    <Card isCompact className={getIoTempStatusClass(monitor.thermal.soc2)}>
                                        <CardBody>
                                            <Title headingLevel="h4" size="md" className="pi-card-label">SoC Temp 2</Title>
                                            <Title headingLevel="h3">{monitor.thermal.soc2}</Title>
                                        </CardBody>
                                    </Card>
                                    <Card isCompact className={getIoTempStatusClass(monitor.thermal.platform)}>
                                        <CardBody>
                                            <Title headingLevel="h4" size="md" className="pi-card-label">Platform Temp</Title>
                                            <Title headingLevel="h3">{monitor.thermal.platform}</Title>
                                        </CardBody>
                                    </Card>
                                </Gallery>
                            </>
                        )}

                        {/* System Summary section: CPU, RAM, uptime, kernel, load, and root usage. */}
                        {visibleSections.system && (
                            <>
                                <Content>
                                    <Title headingLevel="h2">System Summary</Title>
                                    <Content component={ContentVariants.small}>
                                        CPU, RAM, kernel, uptime, load, and root usage
                                    </Content>
                                </Content>
                                <Gallery hasGutter minWidths={{ default: "220px" }}>
                                    <Card isCompact>
                                        <CardBody>
                                            <Title headingLevel="h4" size="md" className="pi-card-label">System Model</Title>
                                            <Title headingLevel="h3">{monitor.system.model}</Title>
                                        </CardBody>
                                    </Card>
                                    <Card isCompact>
                                        <CardBody>
                                            <Title headingLevel="h4" size="md" className="pi-card-label">CPU Model</Title>
                                            <Title headingLevel="h3">{monitor.system.cpuModel}</Title>
                                        </CardBody>
                                    </Card>
                                    <Card isCompact>
                                        <CardBody>
                                            <Title headingLevel="h4" size="md" className="pi-card-label">CPU Frequency</Title>
                                            <Title headingLevel="h3">{monitor.system.cpuFrequency}</Title>
                                        </CardBody>
                                    </Card>
                                    <Card isCompact>
                                        <CardBody>
                                            <Title headingLevel="h4" size="md" className="pi-card-label">Total RAM</Title>
                                            <Title headingLevel="h3">{monitor.system.totalRam}</Title>
                                        </CardBody>
                                    </Card>
                                    <Card isCompact>
                                        <CardBody>
                                            <Title headingLevel="h4" size="md" className="pi-card-label">Used RAM</Title>
                                            <Title headingLevel="h3">{monitor.system.usedRam}</Title>
                                        </CardBody>
                                    </Card>
                                    <Card isCompact>
                                        <CardBody>
                                            <Title headingLevel="h4" size="md" className="pi-card-label">Memory Usage</Title>
                                            <Title headingLevel="h3">{monitor.system.memoryUsage}</Title>
                                        </CardBody>
                                    </Card>
                                    <Card isCompact>
                                        <CardBody>
                                            <Title headingLevel="h4" size="md" className="pi-card-label">Uptime</Title>
                                            <Title headingLevel="h3">{monitor.system.uptime}</Title>
                                        </CardBody>
                                    </Card>
                                    <Card isCompact>
                                        <CardBody>
                                            <Title headingLevel="h4" size="md" className="pi-card-label">Kernel</Title>
                                            <Title headingLevel="h3">{monitor.system.kernel}</Title>
                                        </CardBody>
                                    </Card>
                                    <Card isCompact>
                                        <CardBody>
                                            <Title headingLevel="h4" size="md" className="pi-card-label">Load Average</Title>
                                            <Flex justifyContent={{ default: "justifyContentSpaceBetween" }}>
                                                <FlexItem>
                                                    <Title headingLevel="h4" size="md" className="pi-card-label">&nbsp;&nbsp;&nbsp;1m</Title>
                                                </FlexItem>
                                                <FlexItem>
                                                    <Title headingLevel="h4" size="md" className="pi-card-label">&nbsp;5m</Title>
                                                </FlexItem>
                                                <FlexItem style={{ marginRight: "0.5rem" }}>
                                                    <Title headingLevel="h4" size="md" className="pi-card-label">15m</Title>
                                                </FlexItem>
                                            </Flex>
                                            <Flex justifyContent={{ default: "justifyContentSpaceBetween" }}>
                                                <FlexItem style={{ marginLeft: "0.3rem" }}>
                                                    <Title headingLevel="h3">{monitor.system.loadAverage.split(" ")[0] || "--"}</Title>
                                                </FlexItem>
                                                <FlexItem>
                                                    <Title headingLevel="h3">{monitor.system.loadAverage.split(" ")[1] || "--"}</Title>
                                                </FlexItem>
                                                <FlexItem style={{ marginRight: "0.3rem" }}>
                                                    <Title headingLevel="h3">{monitor.system.loadAverage.split(" ")[2] || "--"}</Title>
                                                </FlexItem>
                                            </Flex>
                                        </CardBody>
                                    </Card>
                                    <Card isCompact>
                                        <CardBody>
                                            <Title headingLevel="h4" size="md" className="pi-card-label">Root Filesystem Used</Title>
                                            <Title headingLevel="h3">{monitor.system.rootFilesystemUsed}</Title>
                                        </CardBody>
                                    </Card>
                                </Gallery>
                            </>
                        )}

                        {/* Boot / Device Info section: root device type and USB presence. */}
                        {visibleSections.boot && (
                            <>
                                <Content>
                                    <Title headingLevel="h2">Boot / Device Info</Title>
                                    <Content component={ContentVariants.small}>
                                        Root device, storage type, and USB storage presence
                                    </Content>
                                </Content>
                                <Gallery hasGutter minWidths={{ default: "220px" }}>
                                    <Card isCompact>
                                        <CardBody>
                                            <Title headingLevel="h4" size="md" className="pi-card-label">Boot Device</Title>
                                            <Title headingLevel="h3">{monitor.boot.bootDevice}</Title>
                                        </CardBody>
                                    </Card>
                                    <Card isCompact>
                                        <CardBody>
                                            <Title headingLevel="h4" size="md" className="pi-card-label">Root Device</Title>
                                            <Title headingLevel="h3">{monitor.boot.rootDevice}</Title>
                                        </CardBody>
                                    </Card>
                                    <Card isCompact>
                                        <CardBody>
                                            <Title headingLevel="h4" size="md" className="pi-card-label">USB Storage Present</Title>
                                            <Title headingLevel="h3">{monitor.boot.usbStoragePresent}</Title>
                                        </CardBody>
                                    </Card>
                                </Gallery>
                            </>
                        )}

                        {/* Root Storage section: root filesystem device, mount point, and usage details. */}
                        {visibleSections.rootStorage && (
                            <>
                                <Content>
                                    <Title headingLevel="h2">Root Storage</Title>
                                    <Content component={ContentVariants.small}>
                                        Root filesystem device, mount point, size, and usage
                                    </Content>
                                </Content>
                                <Gallery hasGutter minWidths={{ default: "220px" }}>
                                    <Card isCompact>
                                        <CardBody>
                                            <Title headingLevel="h4" size="md" className="pi-card-label">Device</Title>
                                            <Title headingLevel="h3">{monitor.rootStorage.device}</Title>
                                        </CardBody>
                                    </Card>
                                    <Card isCompact>
                                        <CardBody>
                                            <Title headingLevel="h4" size="md" className="pi-card-label">Mounted At</Title>
                                            <Title headingLevel="h3">{monitor.rootStorage.mountedAt}</Title>
                                        </CardBody>
                                    </Card>
                                    <Card isCompact>
                                        <CardBody>
                                            <Title headingLevel="h4" size="md" className="pi-card-label">Size</Title>
                                            <Title headingLevel="h3">{monitor.rootStorage.size}</Title>
                                        </CardBody>
                                    </Card>
                                    <Card isCompact>
                                        <CardBody>
                                            <Title headingLevel="h4" size="md" className="pi-card-label">Used</Title>
                                            <Title headingLevel="h3">{monitor.rootStorage.used}</Title>
                                        </CardBody>
                                    </Card>
                                    <Card isCompact>
                                        <CardBody>
                                            <Title headingLevel="h4" size="md" className="pi-card-label">Free</Title>
                                            <Title headingLevel="h3">{monitor.rootStorage.free}</Title>
                                        </CardBody>
                                    </Card>
                                    <Card isCompact>
                                        <CardBody>
                                            <Title headingLevel="h4" size="md" className="pi-card-label">Used Percent</Title>
                                            <Title headingLevel="h3">{monitor.rootStorage.usedPercent}</Title>
                                        </CardBody>
                                    </Card>
                                </Gallery>
                            </>
                        )}

                        {/* External USB Storage section: shown only when a USB disk is detected. */}
                        {visibleSections.usbStorage && showUsbStorageSection && (
                            <>
                                <Content>
                                    <Title headingLevel="h2">External USB Storage</Title>
                                    <Content component={ContentVariants.small}>
                                        Connected USB storage device details
                                    </Content>
                                </Content>
                                <Gallery hasGutter minWidths={{ default: "220px" }}>
                                    <Card isCompact>
                                        <CardBody>
                                            <Title headingLevel="h4" size="md" className="pi-card-label">Model</Title>
                                            <Title headingLevel="h3">{monitor.usbStorage.model}</Title>
                                        </CardBody>
                                    </Card>
                                    <Card isCompact>
                                        <CardBody>
                                            <Title headingLevel="h4" size="md" className="pi-card-label">Capacity</Title>
                                            <Title headingLevel="h3">{monitor.usbStorage.capacity}</Title>
                                        </CardBody>
                                    </Card>
                                    <Card isCompact>
                                        <CardBody>
                                            <Title headingLevel="h4" size="md" className="pi-card-label">Free Space</Title>
                                            <Title headingLevel="h3">{monitor.usbStorage.freeSpace}</Title>
                                        </CardBody>
                                    </Card>
                                    <Card isCompact>
                                        <CardBody>
                                            <Title headingLevel="h4" size="md" className="pi-card-label">Device Path</Title>
                                            <Title headingLevel="h3">{monitor.usbStorage.devicePath}</Title>
                                        </CardBody>
                                    </Card>
                                    <Card isCompact>
                                        <CardBody>
                                            <Title headingLevel="h4" size="md" className="pi-card-label">Mounted At</Title>
                                            <Title headingLevel="h3">{monitor.usbStorage.mountedAt}</Title>
                                        </CardBody>
                                    </Card>
                                </Gallery>
                            </>
                        )}
                    </CardBody>
                </Card>
            </PageSection>
        </Page>
    );
};

export default Application;

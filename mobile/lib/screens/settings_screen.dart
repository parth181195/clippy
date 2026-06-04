import 'package:disable_battery_optimization/disable_battery_optimization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_background_service/flutter_background_service.dart';
import '../app.dart' show ScreenHeader;
import '../services/error_reporting.dart';
import '../services/sync_service.dart';
import '../services/theme_controller.dart';
import '../theme.dart';
import 'pairing_screen.dart';

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: SyncService.instance,
      builder: (ctx, child) {
        final svc = SyncService.instance;
        return ListView(
          padding: const EdgeInsets.only(bottom: 120),
          children: [
            const ScreenHeader(title: 'Settings'),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: _PairedDevicesPanel(svc: svc),
            ),
            const _SectionLabel('Background'),
            const _BackgroundCard(),
            const _SectionLabel('Appearance'),
            const _ThemePicker(),
            const _SectionLabel('Diagnostics'),
            const _CrashReportingCard(),
            const _SectionLabel('About'),
            _Group(children: [
              _Row(label: 'Clippy', trailing: Text('v0.1.0', style: TextStyle(color: ClippyTokens.textSecDark, fontSize: 13)), last: true),
            ]),
          ],
        );
      },
    );
  }

}

class _ThemePicker extends StatelessWidget {
  const _ThemePicker();
  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<int>(
      valueListenable: ThemeController.instance.rev,
      builder: (ctx, rev, child) {
        final mode = ThemeController.instance.mode;
        Widget seg(ClippyMode m, String label, IconData icon) {
          final active = m == mode;
          return Expanded(
            child: GestureDetector(
              onTap: () => ThemeController.instance.set(m),
              child: Container(
                margin: const EdgeInsets.all(4),
                padding: const EdgeInsets.symmetric(vertical: 10),
                decoration: BoxDecoration(
                  color: active ? ClippyTokens.accent : Colors.transparent,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Column(children: [
                  Icon(icon, size: 18, color: active ? Colors.white : ClippyTokens.textSecDark),
                  const SizedBox(height: 4),
                  Text(label, style: TextStyle(
                    color: active ? Colors.white : ClippyTokens.textSecDark,
                    fontSize: 11, fontWeight: FontWeight.w600,
                  )),
                ]),
              ),
            ),
          );
        }
        return Container(
          margin: const EdgeInsets.symmetric(horizontal: 16),
          decoration: BoxDecoration(
            color: ClippyTokens.surfaceDark,
            border: Border.all(color: ClippyTokens.borderSubtleDark),
            borderRadius: BorderRadius.circular(14),
          ),
          child: Row(children: [
            seg(ClippyMode.dark, 'Dark', Icons.dark_mode_outlined),
            seg(ClippyMode.light, 'Light', Icons.light_mode_outlined),
            seg(ClippyMode.oled, 'OLED', Icons.contrast),
          ]),
        );
      },
    );
  }
}

class _PairedDevicesPanel extends StatelessWidget {
  final SyncService svc;
  const _PairedDevicesPanel({required this.svc});

  static const _softWarn = 4;
  static const _hardCap = 8;

  @override
  Widget build(BuildContext context) {
    final conns = svc.connections;
    if (conns.isEmpty) {
      return FilledButton.icon(
        onPressed: () => Navigator.of(context).push(
          MaterialPageRoute(builder: (_) => const PairingScreen()),
        ),
        icon: const Icon(Icons.qr_code_scanner),
        label: const Text('Pair with desktop'),
        style: FilledButton.styleFrom(
          backgroundColor: ClippyTokens.accent,
          padding: const EdgeInsets.symmetric(vertical: 16),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        ),
      );
    }
    final atHardCap = conns.length >= _hardCap;
    final atSoftWarn = conns.length >= _softWarn;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final c in conns) ...[
          _DeviceRow(svc: svc, c: c),
          const SizedBox(height: 10),
        ],
        SizedBox(
          width: double.infinity,
          child: OutlinedButton.icon(
            onPressed: atHardCap
                ? null
                : () => Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => const PairingScreen()),
                    ),
            icon: const Icon(Icons.add, size: 18),
            label: Text(atHardCap
                ? 'Pairing cap reached (8)'
                : 'Pair another desktop'),
            style: OutlinedButton.styleFrom(
              padding: const EdgeInsets.symmetric(vertical: 14),
              side: BorderSide(color: ClippyTokens.borderStrongDark),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              foregroundColor: ClippyTokens.textDark,
            ),
          ),
        ),
        if (atSoftWarn && !atHardCap) ...[
          const SizedBox(height: 6),
          Text(
            '${conns.length} paired · battery use grows with each connection',
            style: TextStyle(color: ClippyTokens.textTerDark, fontSize: 11, fontFamily: 'monospace'),
            textAlign: TextAlign.center,
          ),
        ],
      ],
    );
  }
}

class _DeviceRow extends StatelessWidget {
  final SyncService svc;
  final SyncConnection c;
  const _DeviceRow({required this.svc, required this.c});

  String get _stateLabel => switch (c.state) {
        ConnState.connected => 'Connected · LAN',
        ConnState.connecting => 'Connecting…',
        ConnState.disconnected => 'Offline',
        ConnState.unpaired => 'Not paired',
      };

  Color get _dotColor => c.state == ConnState.connected
      ? const Color(0xFF7CE8B5)
      : (c.state == ConnState.connecting
          ? ClippyTokens.accent
          : ClippyTokens.textTerDark);

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 12, 8, 12),
      decoration: BoxDecoration(
        color: ClippyTokens.surfaceDark,
        border: Border.all(color: ClippyTokens.borderSubtleDark),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        children: [
          Stack(
            clipBehavior: Clip.none,
            children: [
              Container(
                width: 40, height: 40,
                decoration: BoxDecoration(
                  color: ClippyTokens.accent.withValues(alpha: 0.13),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(Icons.monitor, color: ClippyTokens.accent, size: 20),
              ),
              Positioned(
                bottom: -2, right: -2,
                child: Container(
                  width: 12, height: 12,
                  decoration: BoxDecoration(
                    color: _dotColor,
                    shape: BoxShape.circle,
                    border: Border.all(color: ClippyTokens.surfaceDark, width: 2.5),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  c.desktopName,
                  style: TextStyle(color: ClippyTokens.textDark, fontSize: 15, fontWeight: FontWeight.w700, letterSpacing: -0.2),
                ),
                const SizedBox(height: 2),
                Text(
                  _stateLabel,
                  style: TextStyle(color: ClippyTokens.textSecDark, fontSize: 11.5, fontFamily: 'monospace'),
                ),
              ],
            ),
          ),
          PopupMenuButton<String>(
            tooltip: 'Device actions',
            icon: Icon(Icons.more_vert, color: ClippyTokens.textSecDark, size: 20),
            color: ClippyTokens.surfaceRaisedDark,
            onSelected: (v) async {
              switch (v) {
                case 'unpair':
                  await svc.unpairDevice(c.deviceId);
                  break;
              }
            },
            itemBuilder: (_) => [
              PopupMenuItem(
                value: 'unpair',
                child: Row(children: [
                  Icon(Icons.link_off, size: 16, color: Colors.redAccent),
                  const SizedBox(width: 10),
                  Text('Unpair', style: TextStyle(color: ClippyTokens.textDark)),
                ]),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _CrashReportingCard extends StatefulWidget {
  const _CrashReportingCard();
  @override
  State<_CrashReportingCard> createState() => _CrashReportingCardState();
}

class _CrashReportingCardState extends State<_CrashReportingCard> {
  @override
  Widget build(BuildContext context) {
    return _Group(children: [
      _Row(
        label: 'Send crash reports',
        hint: 'Automatic error reports help fix beta bugs. Your clipboard contents are never sent.',
        trailing: Switch(
          value: ErrorReporting.instance.enabled,
          onChanged: (v) async {
            await ErrorReporting.instance.set(v);
            if (mounted) setState(() {});
          },
        ),
        last: true,
      ),
    ]);
  }
}

class _SectionLabel extends StatelessWidget {
  final String text;
  const _SectionLabel(this.text);
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(22, 18, 22, 8),
      child: Text(text.toUpperCase(),
          style: TextStyle(
            color: ClippyTokens.textTerDark, fontSize: 10.5, fontWeight: FontWeight.w700,
            letterSpacing: 1.2, fontFamily: 'monospace',
          )),
    );
  }
}

class _Group extends StatelessWidget {
  final List<Widget> children;
  const _Group({required this.children});
  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      decoration: BoxDecoration(
        color: ClippyTokens.surfaceDark,
        border: Border.all(color: ClippyTokens.borderSubtleDark),
        borderRadius: BorderRadius.circular(14),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(children: children),
    );
  }
}

class _Row extends StatelessWidget {
  final String label;
  final String? hint;
  final Widget? trailing;
  final VoidCallback? onTap;
  final bool last;
  const _Row({required this.label, this.hint, this.trailing, this.onTap, this.last = false});
  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          border: last ? null : Border(bottom: BorderSide(color: ClippyTokens.borderSubtleDark)),
        ),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label, style: TextStyle(color: ClippyTokens.textDark, fontSize: 14, fontWeight: FontWeight.w500)),
                  if (hint != null) ...[
                    const SizedBox(height: 2),
                    Text(hint!, style: TextStyle(color: ClippyTokens.textSecDark, fontSize: 11.5, height: 1.4)),
                  ],
                ],
              ),
            ),
            if (trailing != null) trailing!,
          ],
        ),
      ),
    );
  }
}

class _BackgroundCard extends StatefulWidget {
  const _BackgroundCard();
  @override
  State<_BackgroundCard> createState() => _BackgroundCardState();
}

class _BackgroundCardState extends State<_BackgroundCard> {
  bool? _batteryOptOff;
  bool _serviceRunning = false;

  @override
  void initState() {
    super.initState();
    _refresh();
  }

  Future<void> _refresh() async {
    final isOff = await DisableBatteryOptimization.isBatteryOptimizationDisabled;
    final running = await FlutterBackgroundService().isRunning();
    if (!mounted) return;
    setState(() {
      _batteryOptOff = isOff;
      _serviceRunning = running;
    });
  }

  @override
  Widget build(BuildContext context) {
    return _Group(children: [
      _Row(
        label: 'Foreground service',
        hint: _serviceRunning
            ? 'Active — sync survives when Clippy is closed.'
            : 'Not running.',
        trailing: Icon(
          _serviceRunning ? Icons.check_circle_outline : Icons.circle_outlined,
          size: 18, color: _serviceRunning ? const Color(0xFF7CE8B5) : ClippyTokens.textTerDark,
        ),
        last: _batteryOptOff == true,
      ),
      if (_batteryOptOff == false)
        _Row(
          label: 'Disable battery optimization',
          hint: 'Recommended so Android keeps the connection alive.',
          trailing: Icon(Icons.battery_charging_full, size: 18, color: ClippyTokens.accent),
          onTap: () async {
            await DisableBatteryOptimization.showDisableBatteryOptimizationSettings();
            _refresh();
          },
          last: true,
        ),
    ]);
  }
}

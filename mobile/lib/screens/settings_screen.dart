import 'package:disable_battery_optimization/disable_battery_optimization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_background_service/flutter_background_service.dart';
import '../services/sync_service.dart';
import '../theme.dart';
import 'pairing_screen.dart';

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  String _stateLabel(ConnState s) => switch (s) {
        ConnState.unpaired => 'Not paired',
        ConnState.connecting => 'Connecting…',
        ConnState.connected => 'Connected',
        ConnState.disconnected => 'Disconnected',
      };

  Color _stateColor(ConnState s) => switch (s) {
        ConnState.connected => Colors.greenAccent,
        ConnState.connecting => Colors.amberAccent,
        ConnState.disconnected => Colors.redAccent,
        ConnState.unpaired => ClippyTokens.textTerDark,
      };

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: SyncService.instance,
      builder: (ctx, child) {
        final svc = SyncService.instance;
        return ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Card(
              color: ClippyTokens.surfaceDark,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          width: 8, height: 8,
                          decoration: BoxDecoration(
                            color: _stateColor(svc.state),
                            shape: BoxShape.circle,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Text(_stateLabel(svc.state), style: TextStyle(color: ClippyTokens.textDark, fontWeight: FontWeight.w600)),
                      ],
                    ),
                    if (svc.desktopName != null) ...[
                      const SizedBox(height: 8),
                      Text('Paired with: ${svc.desktopName}', style: TextStyle(color: ClippyTokens.textSecDark)),
                    ],
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
            if (svc.state == ConnState.unpaired)
              FilledButton.icon(
                onPressed: () {
                  Navigator.of(context).push(MaterialPageRoute(builder: (_) => const PairingScreen()));
                },
                icon: const Icon(Icons.qr_code_scanner),
                label: const Text('Pair with desktop'),
                style: FilledButton.styleFrom(
                  backgroundColor: ClippyTokens.accent,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
              )
            else
              OutlinedButton.icon(
                onPressed: () async {
                  await svc.unpair();
                },
                icon: const Icon(Icons.link_off),
                label: const Text('Unpair'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: Colors.redAccent,
                  side: const BorderSide(color: Colors.redAccent),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
              ),
            const SizedBox(height: 24),
            const _BackgroundCard(),
          ],
        );
      },
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
    return Card(
      color: ClippyTokens.surfaceDark,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Background sync',
                style: TextStyle(color: ClippyTokens.textDark, fontWeight: FontWeight.w600)),
            const SizedBox(height: 6),
            Text(
              _serviceRunning
                  ? 'Foreground service active — sync survives when Clippy is closed.'
                  : 'Service not running.',
              style: TextStyle(color: ClippyTokens.textSecDark, fontSize: 12),
            ),
            const SizedBox(height: 12),
            if (_batteryOptOff == false)
              OutlinedButton.icon(
                onPressed: () async {
                  await DisableBatteryOptimization.showDisableBatteryOptimizationSettings();
                  _refresh();
                },
                icon: const Icon(Icons.battery_charging_full),
                label: const Text('Disable battery optimization'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: ClippyTokens.accent,
                  side: BorderSide(color: ClippyTokens.accent),
                ),
              )
            else if (_batteryOptOff == true)
              Row(
                children: [
                  Icon(Icons.check_circle_outline, color: Colors.greenAccent, size: 16),
                  const SizedBox(width: 6),
                  Text('Battery optimization disabled',
                      style: TextStyle(color: ClippyTokens.textSecDark, fontSize: 12)),
                ],
              ),
          ],
        ),
      ),
    );
  }
}

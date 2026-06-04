import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../app.dart' show ScreenHeader;
import '../services/device_identity.dart';
import '../services/sync_service.dart';
import '../theme.dart';

/// Per-connection state for the multi-pair feature. The desktop has a mirror
/// of this in its Settings (D-task) — keeping the two visually similar makes
/// support easier.
class DiagnosticsScreen extends StatelessWidget {
  const DiagnosticsScreen({super.key});

  String _stateLabel(ConnState s) => switch (s) {
        ConnState.connected => 'connected',
        ConnState.connecting => 'connecting',
        ConnState.disconnected => 'offline',
        ConnState.unpaired => 'not paired',
      };

  Color _stateColor(ConnState s) => switch (s) {
        ConnState.connected => const Color(0xFF7CE8B5),
        ConnState.connecting => ClippyTokens.accent,
        _ => ClippyTokens.textTerDark,
      };

  @override
  Widget build(BuildContext context) {
    final svc = SyncService.instance;
    return Scaffold(
      backgroundColor: ClippyTokens.bgSolidDark,
      body: SafeArea(
        bottom: false,
        child: AnimatedBuilder(
          animation: svc,
          builder: (ctx, _) {
            final conns = svc.connections;
            final lines = <String>[
              'phone device_id: ${DeviceIdentity.instance.deviceId}',
              'paired count: ${conns.length}',
              ...conns.map((c) =>
                  '  • ${c.desktopName} (${c.deviceId.substring(0, 12)}…) — ${_stateLabel(c.state)} — ${c.paired.host}:${c.paired.port}'),
            ];
            return ListView(
              padding: const EdgeInsets.only(bottom: 32),
              children: [
                ScreenHeader(
                  title: 'Diagnostics',
                  actions: [
                    IconButton(
                      tooltip: 'Copy as text',
                      icon: Icon(Icons.copy, color: ClippyTokens.textSecDark),
                      onPressed: () async {
                        await Clipboard.setData(ClipboardData(text: lines.join('\n')));
                        if (!ctx.mounted) return;
                        ScaffoldMessenger.of(ctx).showSnackBar(
                          const SnackBar(
                            content: Text('Copied diagnostics'),
                            duration: Duration(milliseconds: 1200),
                          ),
                        );
                      },
                    ),
                  ],
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: ClippyTokens.surfaceDark,
                      border: Border.all(color: ClippyTokens.borderSubtleDark),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'This phone',
                          style: TextStyle(
                            color: ClippyTokens.textTerDark,
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 1.2,
                            fontFamily: 'monospace',
                          ),
                        ),
                        const SizedBox(height: 8),
                        SelectableText(
                          DeviceIdentity.instance.deviceId,
                          style: TextStyle(
                            color: ClippyTokens.textDark,
                            fontSize: 12.5,
                            fontFamily: 'monospace',
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 14),
                if (conns.isEmpty)
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: Text(
                      'No paired desktops.',
                      style: TextStyle(color: ClippyTokens.textSecDark, fontSize: 13),
                    ),
                  ),
                for (final c in conns) ...[
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: ClippyTokens.surfaceDark,
                        border: Border.all(color: ClippyTokens.borderSubtleDark),
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Container(
                                width: 8, height: 8,
                                decoration: BoxDecoration(
                                  color: _stateColor(c.state),
                                  shape: BoxShape.circle,
                                ),
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  c.desktopName,
                                  style: TextStyle(
                                    color: ClippyTokens.textDark,
                                    fontSize: 14,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ),
                              Text(
                                _stateLabel(c.state),
                                style: TextStyle(
                                  color: _stateColor(c.state),
                                  fontSize: 11,
                                  fontWeight: FontWeight.w600,
                                  fontFamily: 'monospace',
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 10),
                          _kv('device_id', c.deviceId),
                          _kv('host', '${c.paired.host}:${c.paired.port}'),
                          _kv('active transfers', '${c.transfers.length}'),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 10),
                ],
              ],
            );
          },
        ),
      ),
    );
  }

  Widget _kv(String k, String v) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 110,
            child: Text(
              k,
              style: TextStyle(
                color: ClippyTokens.textTerDark,
                fontSize: 11,
                fontFamily: 'monospace',
              ),
            ),
          ),
          Expanded(
            child: SelectableText(
              v,
              style: TextStyle(
                color: ClippyTokens.textSecDark,
                fontSize: 11.5,
                fontFamily: 'monospace',
              ),
            ),
          ),
        ],
      ),
    );
  }
}

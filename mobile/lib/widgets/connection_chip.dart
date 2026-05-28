import 'package:flutter/material.dart';
import '../services/sync_service.dart';
import '../theme.dart';

/// Compact connection-status chip: monitor avatar + device name + state dot.
class ConnectionChip extends StatelessWidget {
  const ConnectionChip({super.key});

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: SyncService.instance,
      builder: (ctx, _) {
        final svc = SyncService.instance;
        final state = svc.state;
        final name = svc.desktopName ?? 'desktop';
        final (Color dot, String label) = switch (state) {
          ConnState.connected => (const Color(0xFF7CE8B5), 'Connected to $name'),
          ConnState.connecting => (const Color(0xFFE6BD6C), 'Connecting…'),
          ConnState.disconnected => (const Color(0xFFA55C5C), '$name offline'),
          ConnState.unpaired => (ClippyTokens.textTerDark, 'No device paired'),
        };
        return Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: BoxDecoration(
            color: ClippyTokens.surfaceDark,
            border: Border.all(color: ClippyTokens.borderSubtleDark),
            borderRadius: BorderRadius.circular(14),
          ),
          child: Row(
            children: [
              Container(
                width: 28, height: 28,
                decoration: BoxDecoration(
                  color: ClippyTokens.accent.withValues(alpha: 0.13),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(Icons.monitor, size: 15, color: ClippyTokens.accent),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  label,
                  maxLines: 1, overflow: TextOverflow.ellipsis,
                  style: TextStyle(color: ClippyTokens.textDark, fontSize: 13, fontWeight: FontWeight.w500),
                ),
              ),
              Container(width: 8, height: 8, decoration: BoxDecoration(color: dot, shape: BoxShape.circle)),
            ],
          ),
        );
      },
    );
  }
}

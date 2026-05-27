import 'package:flutter/material.dart';
import '../services/sync_service.dart';
import '../theme.dart';

class TransferBanner extends StatelessWidget {
  const TransferBanner({super.key});

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: SyncService.instance,
      builder: (ctx, _) {
        final ts = SyncService.instance.transfers.values.toList();
        if (ts.isEmpty) return const SizedBox.shrink();
        return Material(
          color: Colors.transparent,
          child: Column(
            children: ts.map((t) {
              final pct = (t.sent / (t.total == 0 ? 1 : t.total)).clamp(0.0, 1.0);
              return Container(
                margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                padding: const EdgeInsets.fromLTRB(12, 8, 12, 10),
                decoration: BoxDecoration(
                  color: ClippyTokens.surfaceRaisedDark,
                  border: Border.all(color: ClippyTokens.borderStrongDark),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      children: [
                        Icon(
                          t.direction == 'in' ? Icons.south_outlined : Icons.north_outlined,
                          size: 14, color: ClippyTokens.textSecDark,
                        ),
                        const SizedBox(width: 6),
                        Icon(
                          t.kind == 'image' ? Icons.image_outlined : Icons.insert_drive_file_outlined,
                          size: 14, color: ClippyTokens.textSecDark,
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            t.name,
                            maxLines: 1, overflow: TextOverflow.ellipsis,
                            style: TextStyle(color: ClippyTokens.textDark, fontSize: 12),
                          ),
                        ),
                        Text(
                          t.done ? 'done' : '${(pct * 100).round()}%',
                          style: TextStyle(color: ClippyTokens.textSecDark, fontSize: 11),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(2),
                      child: LinearProgressIndicator(
                        value: pct,
                        minHeight: 3,
                        backgroundColor: ClippyTokens.surfaceSunkenDark,
                        valueColor: AlwaysStoppedAnimation(ClippyTokens.accent),
                      ),
                    ),
                  ],
                ),
              );
            }).toList(),
          ),
        );
      },
    );
  }
}

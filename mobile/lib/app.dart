import 'package:flutter/material.dart';
import 'screens/recent_screen.dart';
import 'screens/send_screen.dart';
import 'screens/settings_screen.dart';
import 'services/sync_service.dart';
import 'services/theme_controller.dart';
import 'theme.dart';
import 'widgets/transfer_banner.dart';

final clippyMessengerKey = GlobalKey<ScaffoldMessengerState>();

class ClippyApp extends StatelessWidget {
  const ClippyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<int>(
      valueListenable: ThemeController.instance.rev,
      builder: (context, rev, _) {
        return MaterialApp(
          title: 'Clippy',
          debugShowCheckedModeBanner: false,
          scaffoldMessengerKey: clippyMessengerKey,
          theme: clippyThemeFor(ThemeController.instance.mode),
          // Key by the revision so the whole subtree rebuilds on any theme OR
          // accent change — widgets read ClippyTokens static colors at build
          // time and otherwise wouldn't repaint until navigated. Selected tab
          // survives via the module-level _savedTab.
          home: HomeShell(key: ValueKey(rev)),
        );
      },
    );
  }
}

class HomeShell extends StatefulWidget {
  const HomeShell({super.key});
  @override
  State<HomeShell> createState() => _HomeShellState();
}

// Survives the keyed rebuild on theme change so we don't snap back to Recent.
int _savedTab = 0;

class _HomeShellState extends State<HomeShell> {
  int _idx = _savedTab;

  static const _pages = [RecentScreen(), SendScreen(), SettingsScreen()];

  @override
  void initState() {
    super.initState();
    SyncService.instance.addListener(_onSync);
  }

  @override
  void dispose() {
    SyncService.instance.removeListener(_onSync);
    super.dispose();
  }

  void _onSync() {
    if (mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ClippyTokens.bgSolidDark,
      body: Stack(
        children: [
          SafeArea(bottom: false, child: _pages[_idx]),
          const Positioned(
            left: 0, right: 0, bottom: 96,
            child: TransferBanner(),
          ),
          Positioned(
            left: 0, right: 0, bottom: 0,
            child: _PillNav(
              index: _idx,
              connState: SyncService.instance.state,
              onTap: (i) => setState(() { _idx = i; _savedTab = i; }),
            ),
          ),
        ],
      ),
    );
  }
}

class _PillNav extends StatelessWidget {
  final int index;
  final ConnState connState;
  final ValueChanged<int> onTap;
  const _PillNav({required this.index, required this.connState, required this.onTap});

  static const _tabs = [
    (icon: Icons.content_paste, label: 'Recent'),
    (icon: Icons.send, label: 'Send'),
    (icon: Icons.settings, label: 'Settings'),
  ];

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.bottomCenter, end: Alignment.topCenter,
          colors: [ClippyTokens.bgSolidDark, ClippyTokens.bgSolidDark.withValues(alpha: 0)],
        ),
      ),
      child: Container(
        decoration: BoxDecoration(
          color: ClippyTokens.surfaceDark,
          border: Border.all(color: ClippyTokens.borderSubtleDark),
          borderRadius: BorderRadius.circular(100),
          boxShadow: const [BoxShadow(color: Color(0x2E000000), blurRadius: 18, offset: Offset(0, 6))],
        ),
        padding: const EdgeInsets.all(4),
        child: Row(
          children: List.generate(_tabs.length, (i) {
            final active = i == index;
            final t = _tabs[i];
            return Expanded(
              flex: active ? 14 : 10,
              child: GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: () => onTap(i),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  curve: Curves.easeOutCubic,
                  padding: const EdgeInsets.symmetric(vertical: 11),
                  decoration: BoxDecoration(
                    color: active ? ClippyTokens.accent : Colors.transparent,
                    borderRadius: BorderRadius.circular(100),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(t.icon, size: 18, color: active ? Colors.white : ClippyTokens.textSecDark),
                      if (active) ...[
                        const SizedBox(width: 7),
                        Flexible(
                          child: Text(
                            t.label,
                            overflow: TextOverflow.clip,
                            softWrap: false,
                            style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            );
          }),
        ),
      ),
    );
  }
}

/// Big-title header used at the top of each screen, matching the design.
class ScreenHeader extends StatelessWidget {
  final String title;
  final List<Widget> actions;
  const ScreenHeader({super.key, required this.title, this.actions = const []});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 8, 12, 14),
      child: Row(
        children: [
          Expanded(
            child: Text(
              title,
              style: TextStyle(
                color: ClippyTokens.textDark,
                fontSize: 30, fontWeight: FontWeight.w700, letterSpacing: -1.2,
              ),
            ),
          ),
          ...actions,
        ],
      ),
    );
  }
}

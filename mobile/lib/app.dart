import 'package:flutter/material.dart';
import 'screens/recent_screen.dart';
import 'screens/send_screen.dart';
import 'screens/settings_screen.dart';
import 'services/sync_service.dart';
import 'theme.dart';
import 'widgets/transfer_banner.dart';

class ClippyApp extends StatelessWidget {
  const ClippyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Clippy',
      debugShowCheckedModeBanner: false,
      theme: clippyTheme(Brightness.dark),
      home: const HomeShell(),
    );
  }
}

class HomeShell extends StatefulWidget {
  const HomeShell({super.key});
  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _idx = 0;

  static const _pages = [RecentScreen(), SendScreen(), SettingsScreen()];
  static const _titles = ['Recent', 'Send', 'Settings'];

  @override
  void initState() {
    super.initState();
    SyncService.instance.addListener(() { if (mounted) setState(() {}); });
  }

  Widget _connDot() {
    final s = SyncService.instance.state;
    final color = switch (s) {
      ConnState.connected => Colors.greenAccent,
      ConnState.connecting => Colors.amberAccent,
      ConnState.disconnected => Colors.redAccent,
      ConnState.unpaired => ClippyTokens.textTerDark,
    };
    return Padding(
      padding: const EdgeInsets.only(right: 16),
      child: Center(
        child: Container(
          width: 10, height: 10,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: _idx == 0
            ? null
            : BackButton(onPressed: () => setState(() => _idx = 0)),
        title: Text(_titles[_idx]),
        actions: [_connDot()],
      ),
      body: Stack(
        children: [
          _pages[_idx],
          const Positioned(
            left: 0, right: 0, bottom: 0,
            child: SafeArea(child: TransferBanner()),
          ),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        backgroundColor: ClippyTokens.surfaceSunkenDark,
        selectedIndex: _idx,
        onDestinationSelected: (i) => setState(() => _idx = i),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.history), label: 'Recent'),
          NavigationDestination(icon: Icon(Icons.send), label: 'Send'),
          NavigationDestination(icon: Icon(Icons.settings), label: 'Settings'),
        ],
      ),
    );
  }
}

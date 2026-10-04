{ pkgs }:
{
  # Prebuilt native addons such as sharp link against libstdc++, which the
  # Nix-built Bun's loader cannot find on its default search path.
  LD_LIBRARY_PATH = pkgs.lib.makeLibraryPath [ pkgs.stdenv.cc.cc.lib ];
}

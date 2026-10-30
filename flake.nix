{
  description = "Rota, its rota command-line tool, and its development environment";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-26.05";

  outputs =
    { self, nixpkgs, ... }:
    let
      systems = [
        "x86_64-linux"
        "aarch64-linux"
      ];
      forAllSystems = nixpkgs.lib.genAttrs systems;
      manifest = builtins.fromJSON (builtins.readFile ./package.json);
      bunFor =
        pkgs:
        pkgs.callPackage ./nix/standards-bun.nix {
          inherit (manifest) packageManager;
        };
      date = self.lastModifiedDate;
      version = "0-unstable-${builtins.substring 0 4 date}-${builtins.substring 4 2 date}-${builtins.substring 6 2 date}";
    in
    {
      packages = forAllSystems (
        system:
        let
          pkgs = nixpkgs.legacyPackages.${system};
          rota-cli = pkgs.callPackage ./nix/package.nix {
            bun = bunFor pkgs;
            inherit version;
          };
        in
        {
          inherit rota-cli;
          default = rota-cli;
        }
      );

      devShells = forAllSystems (
        system:
        let
          pkgs = nixpkgs.legacyPackages.${system};
          bun = bunFor pkgs;
          localShell =
            if builtins.pathExists ./dev-shell.local.nix then
              import ./dev-shell.local.nix { inherit pkgs; }
            else
              { };
        in
        {
          default = pkgs.mkShell (
            localShell
            // {
              packages = [ bun ] ++ (localShell.packages or [ ]);
            }
          );
        }
      );
    };
}

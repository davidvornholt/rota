# rota, compiled with `bun build --compile`, with its agent skills in
# share/rota-cli/skills/<skill>. passthru.skills names them.
{
  bun,
  lib,
  stdenvNoCC,
  version,
}:
let
  pname = "rota-cli";
  # The repository without dependencies, build output, and local state, which a
  # dirty checkout or a path: flake would otherwise copy into the store.
  # lib.fileset can't exclude a directory by name at any depth, so this filters
  # the source by name instead.
  src = lib.cleanSourceWith {
    src = lib.cleanSource ../.;
    filter =
      path: _type:
      !builtins.elem (baseNameOf path) [
        ".direnv"
        ".media"
        ".turbo"
        "dist"
        "node_modules"
      ];
  };
  skills = builtins.attrNames (
    lib.filterAttrs (_name: type: type == "directory") (builtins.readDir ../apps/cli/skills)
  );
  # The CLI's runtime dependencies only; the compiled binary bundles them.
  # The name holds Bun's version and a digest of bun.lock, so a change to either
  # installs them again and fails on a stale hash instead of silently reusing
  # the old dependencies.
  lockDigest = builtins.substring 0 12 (builtins.hashFile "sha256" ../bun.lock);
  nodeModules = stdenvNoCC.mkDerivation {
    name = "${pname}-node-modules-bun-${bun.version}-${lockDigest}";
    inherit src;
    nativeBuildInputs = [ bun ];
    dontConfigure = true;
    buildPhase = ''
      runHook preBuild
      export HOME=$TMPDIR BUN_INSTALL_CACHE_DIR=$TMPDIR/bun-cache
      bun install --frozen-lockfile --production --ignore-scripts --no-progress --filter @rota/cli
      runHook postBuild
    '';
    installPhase = ''
      runHook preInstall
      mkdir "$out"
      find . -type d -name node_modules -prune -print0 | tar --null --files-from=- -cf - | tar -C "$out" -xf -
      runHook postInstall
    '';
    dontFixup = true;
    # A change to bun.lock or to the Bun version in package.json's
    # packageManager needs a new hash here. The failing build prints it after
    # "got:".
    outputHash = "sha256-Ht5oIyJmbSqinhF9LLLw2t067EA3TkKEmQ/aV8xdIjg=";
    outputHashAlgo = "sha256";
    outputHashMode = "recursive";
    impureEnvVars = lib.fetchers.proxyImpureEnvVars;
  };
in
stdenvNoCC.mkDerivation {
  inherit pname version src;
  nativeBuildInputs = [ bun ];
  dontConfigure = true;
  buildPhase = ''
    runHook preBuild
    export HOME=$TMPDIR
    cp -r --no-preserve=mode ${nodeModules}/. .
    cd apps/cli
    bun run build
    runHook postBuild
  '';
  installPhase = ''
    runHook preInstall
    install -Dm755 dist/rota "$out/bin/rota"
    mkdir -p "$out/share/${pname}"
    cp -r skills "$out/share/${pname}/skills"
    runHook postInstall
  '';
  # Bun appends the bundled program to its own executable; leave it intact.
  dontStrip = true;
  dontPatchELF = true;

  passthru = { inherit nodeModules skills; };
  meta = {
    description = "Command-line tool for reading and planning a Rota wardrobe";
    homepage = "https://github.com/davidvornholt/rota";
    mainProgram = "rota";
  };
}

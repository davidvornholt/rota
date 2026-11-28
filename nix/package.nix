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
  # The files git doesn't ignore; package-source.nix says what that protects.
  src = import ./package-source.nix { inherit lib; } ../.;
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
    outputHash = "sha256-Mop2u8ec8lYunNlPOXERH883L279uoDRRjyFrFu0YgM=";
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
  # The Standards workflow builds this package, so a binary that can't start,
  # or skills installed differently from apps/cli/skills, fail `check`. The
  # comparison reads the skills unfiltered, so it also catches a tracked skill
  # file that a .gitignore line keeps out of src.
  doInstallCheck = true;
  installCheckPhase = ''
    runHook preInstallCheck
    HOME=$TMPDIR $out/bin/rota --help >/dev/null
    diff -r ${../apps/cli/skills} "$out/share/${pname}/skills"
    runHook postInstallCheck
  '';

  passthru = { inherit nodeModules skills; };
  meta = {
    description = "Command-line tool for reading and planning a Rota wardrobe";
    homepage = "https://github.com/davidvornholt/rota";
    mainProgram = "rota";
  };
}

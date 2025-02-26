with (import <nixpkgs> {});
let
  basePackages = [
    nodejs-18_x
    yarn
    cairo
    pango
    pkg-config
    nodePackages.node-gyp
    libpng
    librsvg
    pixman
    giflib
    libjpeg
    # TODO: For local dev it's nice to have but you can always add them manudal
    # docker
    # chromedriver
    # act
  ];

  inputs = basePackages
    ++ lib.optional stdenv.isLinux inotify-tools
    ++ lib.optionals stdenv.isDarwin (with darwin.apple_sdk.frameworks; [
        CoreFoundation
        CoreServices
        CoreText
      ]);

in mkShell {
  name = "kubelt/platform";
  allowUnfree = true;

  nativeBuildInputs = [ 
    pkg-config
  ];

  buildInputs = inputs;

  shellHook = ''
    LD=$CC
    export LD_LIBRARY_PATH="$APPEND_LIBRARY_PATH:$LD_LIBRARY_PATH"
  '';
}

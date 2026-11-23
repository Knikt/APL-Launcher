# SF Pro Display fonts

The interface uses **SF Pro Display** by Apple. It is under Apple's license and **is not included** in this repository.

Download it from Apple's developer site, then put the files here with these exact names:

- `SFPRODISPLAYREGULAR.OTF`
- `SFPRODISPLAYMEDIUM.OTF`
- `SFPRODISPLAYBOLD.OTF`

The CSS picks them up automatically. Without them, the interface uses **Inter Display** (the `InterDisplay-*.woff2` files here), the free font closest to SF Pro Display, under the SIL Open Font License (`Inter-OFL.txt`). It is in every package.

The installer can also copy them while building, from `Downloads\sf-pro-display_2` (`03-build-launcher.ps1 -SfProDir <folder>`).

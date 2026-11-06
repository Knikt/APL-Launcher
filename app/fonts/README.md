# SF Pro Display fonts

The interface uses **SF Pro Display** by Apple. It is under Apple's license and **is not included** in this repository.

Download it from Apple's developer site, then put the files here with these exact names:

- `SFPRODISPLAYREGULAR.OTF`
- `SFPRODISPLAYMEDIUM.OTF`
- `SFPRODISPLAYBOLD.OTF`

The CSS picks them up automatically. Without them, the interface uses the system font and works just the same.

The installer can also copy them while building, from `Downloads\sf-pro-display_2` (`03-build-launcher.ps1 -SfProDir <folder>`).

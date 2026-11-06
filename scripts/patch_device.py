f = open('app/device.js', 'rb')
c = f.read()
f.close()

old = b"var SELF = 'nClrkHome1.FrameHome';"
new = b"var SELF = 'CfrmLs03B1.CleanFrame';"

c2 = c.replace(old, new)
f = open('app/device.js', 'wb')
f.write(c2)
f.close()
print('replaced' if c != c2 else 'NOT FOUND')

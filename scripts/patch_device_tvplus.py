f = open('app/device.js', 'rb')
c = f.read()
f.close()

c = c.replace(
    b"'MoonLightS.MoonlightWasm': 'moonlight'",
    b"'MoonLightS.MoonlightWasm': 'moonlight', 'com.samsung.tv.tvplus': 'samsungtvplus', 'com.samsung.tv.tvPlusDeeplinker': 'samsungtvplus'"
)
c = c.replace(
    b"moonlight: 'MoonLightS.MoonlightWasm'",
    b"moonlight: 'MoonLightS.MoonlightWasm', samsungtvplus: 'com.samsung.tv.tvplus'"
)

f = open('app/device.js', 'wb')
f.write(c)
f.close()
print('device.js updated')

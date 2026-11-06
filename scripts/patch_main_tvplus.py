f = open('app/main.js', 'rb')
c = f.read()
f.close()

c = c.replace(
    b"{ id: 'moonlight', name: 'Moonlight', mark: true, appId: 'MoonLightS.MoonlightWasm' }",
    b"{ id: 'moonlight', name: 'Moonlight', mark: true, appId: 'MoonLightS.MoonlightWasm' },\r\n    { id: 'samsungtvplus', name: 'TV Plus', mark: true, appId: 'com.samsung.tv.tvplus' }"
)

c = c.replace(
    b"'moonlight'].indexOf(a.brand)",
    b"'moonlight', 'samsungtvplus'].indexOf(a.brand)"
)

f = open('app/main.js', 'wb')
f.write(c)
f.close()
print('main.js updated')

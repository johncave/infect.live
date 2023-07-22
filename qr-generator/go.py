import qrcode

data = "Q000001"
codes = range(100)

for i in codes:
    #print(i + 1)
    id = "Q%03d" % (i + 1)
    qr = qrcode.QRCode(version=3)
    qr.add_data(id)
    qr.make(fit=True)
    img = qr.make_image()
    img.save("png/%s.png" % id, "PNG")
    print(id)


# img = qrcode.make(data)

# img.save("qr.png", "PNG")
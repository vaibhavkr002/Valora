from PIL import Image

for i in range(1, 7):
    p = Image.open(f"assets/sarojni/prod-{i}-*.png" if False else [
        "assets/sarojni/prod-1-striped-top.png",
        "assets/sarojni/prod-2-graphic-tee.png",
        "assets/sarojni/prod-3-wide-jeans.png",
        "assets/sarojni/prod-4-ruched-dress.png",
        "assets/sarojni/prod-5-classic-sneakers.png",
        "assets/sarojni/prod-6-retro-bag.png"
    ][i - 1])

    # Sample background color from top-left (e.g. at (10, 10))
    bg_color = p.getpixel((10, 10))
    w, h = p.size

    # The heart was in the top right corner (x from w-40 to w, y from 0 to 40)
    # Let's clean that region if it has white circle pixels
    pixels = p.load()
    for x in range(w - 45, w):
        for y in range(0, 45):
            # If pixel is very bright or dark outline (the heart button)
            r, g, b = pixels[x, y][:3]
            # Replace corner area with background color
            pixels[x, y] = bg_color

    filepath = [
        "assets/sarojni/prod-1-striped-top.png",
        "assets/sarojni/prod-2-graphic-tee.png",
        "assets/sarojni/prod-3-wide-jeans.png",
        "assets/sarojni/prod-4-ruched-dress.png",
        "assets/sarojni/prod-5-classic-sneakers.png",
        "assets/sarojni/prod-6-retro-bag.png"
    ][i - 1]
    p.save(filepath)
    print(f"Cleaned {filepath}")


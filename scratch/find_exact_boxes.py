from PIL import Image

im = Image.open('assets/sarojni/sarojni_hm_cover.png')

# 1. Categories - perfect centered circles
r = 58
centers = [133, 313, 493, 673, 853, 1033, 1213, 1393]
names = [
    "cat-tops.png",
    "cat-tees.png",
    "cat-jeans.png",
    "cat-dresses.png",
    "cat-bags.png",
    "cat-sneakers.png",
    "cat-accessories.png",
    "cat-caps.png"
]

for name, cx in zip(names, centers):
    box = (cx - r, 453 - r, cx + r, 453 + r)
    im.crop(box).save(f"assets/sarojni/{name}")

# 2. Product images:
# Let's crop clean images:
# Card width is about 205px, card height about 230px
# The image area of each card:
# Card 1: x: 59 to 251, y: 642 to 792
# Card 2: x: 299 to 491, y: 642 to 792
# Card 3: x: 540 to 732, y: 642 to 792
# Card 4: x: 780 to 972, y: 642 to 792
# Card 5: x: 1021 to 1213, y: 642 to 792
# Card 6: x: 1261 to 1453, y: 642 to 792

prod_crops = [
    ("prod-1-striped-top.png", (65, 645, 245, 792)),
    ("prod-2-graphic-tee.png", (305, 645, 485, 792)),
    ("prod-3-wide-jeans.png", (546, 645, 726, 792)),
    ("prod-4-ruched-dress.png", (786, 645, 966, 792)),
    ("prod-5-classic-sneakers.png", (1027, 645, 1207, 792)),
    ("prod-6-retro-bag.png", (1267, 645, 1447, 792))
]

for name, box in prod_crops:
    im.crop(box).save(f"assets/sarojni/{name}")

# 3. Badge "Fashion for Everyone":
# From y=900 to 975, x=1150 to 1495
badge = im.crop((1155, 903, 1495, 972))
badge.save("assets/sarojni/badge-fashion-for-everyone.png")

# 4. Top Banner:
banner = im.crop((0, 0, 1536, 386))
banner.save("assets/sarojni/sarojini-top-banner.png")

print("All refined assets saved successfully!")


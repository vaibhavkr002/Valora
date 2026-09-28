/**
 * VELORA Admin Portal - Interactive Product Review Seeding & Cleanup Engine
 * 
 * Provides authorized administrators with 1-click test review generation and cleanup.
 * 
 * FEATURES:
 * 1. Generates 12 to 15 unique, context-aware reviews tailored to the active product
 *    (shoes, tops, dresses, bottoms, bags, jewellery, general).
 * 2. Realistic rating distribution with calculated averages (no hardcoded numbers).
 * 3. Varied Indian customer names & natural English/Hinglish phrasing.
 * 4. Deterministic UUID prefix (00005eed-) for collision-free deduplication and cleanup.
 * 5. Surgical cleanup that targets ONLY seeded reviews, keeping genuine customer reviews intact.
 */

(function () {
  'use strict';

  const INDIAN_NAMES = [
    "Ananya Sharma", "Priya Patel", "Sneha Kapoor", "Diya Gupta", "Riya Mehta",
    "Kavya Iyer", "Meera Joshi", "Pooja Agarwal", "Tanvi Deshmukh", "Sakshi Verma",
    "Shreya Nair", "Ishita Sen", "Nandini Rao", "Simran Kaur", "Muskan Choudhary",
    "Ritika Bhatt", "Avni Kulkarni", "Rhea Singhania", "Bhavna Trivedi", "Divya Reddy",
    "Aarav Verma", "Rohan Mehta", "Aditya Sharma", "Karan Malhotra", "Rahul Kumar",
    "Arjun Singh", "Mohit Gupta", "Nikhil Jain", "Varun Nair", "Harsh Patel",
    "Yash Agarwal", "Kabir Mukherjee", "Aryan Kapoor", "Siddharth Sen", "Vansh Saxena",
    "Abhishek Joshi", "Ritik Yadav", "Pranav Rao", "Ishan Bansal", "Tanishq Sethi"
  ];

  const CATEGORY_TEMPLATES = {
    shoes: {
      5: [
        "Sole ka cushioning bohot comfortable hai. Wore these for a full day of walking and zero foot fatigue.",
        "Looks even better in person than on screen. Premium finish on the stitching and great grip on the outsole.",
        "Fitting ekdum true to size aayi. Lightweight feel hai and looks classy with both jeans and cargos.",
        "Authentic quality! The insole support is noticeably better than standard shoes. Definitely value for money.",
        "Delivered in 3 days. Clean silhouette, comfortable arch support, and doesn't pinch around the toes.",
        "Bohot comfortable sneakers hain. Memory foam effect feel hota hai walking karte time. 10/10 purchase."
      ],
      4: [
        "Sole comfort is really good for daily wear. Pehle ek-do din thoda stiff laga but after breaking in, perfectly comfortable.",
        "Design is superb and looks great on feet. Size chart se exactly match karta hai. Box packaging thodi crushed aayi thi but shoes intact the.",
        "Good quality sneakers. Ankle support is nice. Slightly warm for peak summer afternoon, but great for casual evenings.",
        "Fitting achhi hai. Insole is soft. Delivery took 4 days instead of 2, otherwise 5-star sneaker."
      ],
      3: [
        "Look and design achha hai, but sole is on the firmer side. Casual outings ke liye fine hai, not recommended for running.",
        "Decent quality for the price. Fitting thodi snug lagi around the toe box, half size up order karna behtar rehta."
      ],
      2: [
        "Appearance is good, but sole flexibility expected se kam hai. Feels somewhat heavy during long walks."
      ]
    },
    tops: {
      5: [
        "Fabric kaafi comfortable aur soft hai. Fitting exactly size chart ke according aayi.",
        "Really liked the cotton quality. Breathable material hai and doesn't cling even in warm humid weather.",
        "Color same as shown in the pictures. Neckline ribbing is sturdy and stitching is neat.",
        "Pehli wash ke baad bhi color ya fabric shrink nahi hua. Regular casual wear ke liye absolute best pick.",
        "Fabric feels heavy and premium in hand. Not those thin cheap tees. Worth every rupee."
      ],
      4: [
        "Fabric quality bohot achhi hai. Chest fitting is great, though length thodi si lambi lagi. Tucked in pehenne me perfect hai.",
        "Looks very classy in person. Pure breathable fabric. Delivery took 4 days but product quality makes up for it.",
        "Comfortable everyday top. Color washed well with cold water without bleeding. Good buy."
      ],
      3: [
        "Fabric is soft and light, but fitting thodi loose aayi. Definitely recommend checking the measurement guide.",
        "Decent top for casual wear. Material thoda thin laga than expected from photos, best suited for summer."
      ],
      2: [
        "Fabric softness is okay, but fit around the waist wasn't as structured as shown in the model pictures."
      ]
    },
    dresses: {
      5: [
        "The silhouette and flare are stunning! Fabric has a beautiful graceful fall and looks very elegant.",
        "Wore this to an evening dinner and received multiple compliments. Waistline fit is super flattering.",
        "Color is rich and exactly as pictured. Inner lining is soft and non-itchy. Felt so comfortable throughout.",
        "Stitching and hemline details are extremely neat. The zip slides smoothly without catching."
      ],
      4: [
        "Dress fits nicely and looks very chic. Length is slightly long for 5'3 height without heels, but perfect with wedges.",
        "Lovely fabric and color. Chest fitting is comfortable. Delivery box could have been sturdier but dress was spotless."
      ],
      3: [
        "Design and color are pretty, but zipper around the side needs careful handling. Fitting is decent.",
        "Looks good on, but fabric has zero stretch so be very accurate with your bust and waist measurements."
      ],
      2: [
        "Cut is nice, but color shade was visibly different under indoor yellow lighting compared to the website photo."
      ]
    },
    general: {
      5: [
        "Quality bohot achhi hai. Looks exactly as shown on the website and feels durable.",
        "Really satisfied with this purchase. Neat finish, clean details, and great value for money.",
        "Delivered quickly in clean packaging. Fits my expectations perfectly and will definitely buy again.",
        "Authentic feel and great craftsmanship. One of the best purchases from this store so far."
      ],
      4: [
        "Good quality product. Matches the photos and description well. Delivery took 3-4 days.",
        "Nice overall. Finish is neat and looks good in person. Minor packaging crease but product was intact."
      ],
      3: [
        "Decent product for casual use. Expected slightly thicker material but does the job well.",
        "Looks okay in person. Finishing is satisfactory for the price point. Packaging was average."
      ],
      2: [
        "Product appearance is okay, but size / proportion was slightly different than expected from images."
      ]
    }
  };

  function detectCategory(p) {
    const text = `${p.name || ''} ${p.department || ''} ${p.category || ''} ${p.description || ''}`.toLowerCase();
    if (text.match(/shoe|sneaker|runner|footwear|boot|sandal|slide|heel|trainer/)) return 'shoes';
    if (text.match(/t-shirt|tshirt|tee|top|crop top|shirt|polo|ribbed/)) return 'tops';
    if (text.match(/dress|gown|frock|saree|kurti|maxi/)) return 'dresses';
    return 'general';
  }

  // Generates 00005eed-xxxx-4xxx-8xxx-xxxxxxxxxxxx deterministic UUID
  function makeSeedId(productId, index) {
    let raw = `seed_${productId}_${index}`;
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      hash = ((hash << 5) - hash) + raw.charCodeAt(i);
      hash |= 0;
    }
    const hex1 = Math.abs(hash).toString(16).padStart(8, '0');
    const hex2 = Math.abs((hash * 31) | 0).toString(16).padStart(8, '0');
    const hex3 = Math.abs((hash * 37) | 0).toString(16).padStart(8, '0');
    const hex4 = Math.abs((hash * 41) | 0).toString(16).padStart(8, '0');
    const full = (hex1 + hex2 + hex3 + hex4).slice(0, 24);
    return `00005eed-${full.slice(0, 4)}-4${full.slice(5, 8)}-8${full.slice(9, 12)}-${full.slice(12, 24)}`;
  }

  const AdminReviewSeeder = {
    isSeedId: function (id) {
      return typeof id === 'string' && id.startsWith('00005eed-');
    },

    seedProduct: async function (product, catalogType = 'main', targetCount = 14) {
      const client = window.AdminAuth ? window.AdminAuth.getClient() : window.supabaseClient;
      if (!client || !product || !product.id) throw new Error("Database client or product missing");

      const count = Math.max(12, Math.min(15, targetCount));
      const catKey = detectCategory(product);
      const templates = CATEGORY_TEMPLATES[catKey] || CATEGORY_TEMPLATES.general;

      // Realistic rating distribution
      const ratings = [];
      const fiveCount = Math.floor(count * 0.50);
      const fourCount = Math.floor(count * 0.35);
      const threeCount = Math.max(1, Math.floor(count * 0.12));
      const twoCount = count - (fiveCount + fourCount + threeCount);

      for (let i = 0; i < fiveCount; i++) ratings.push(5);
      for (let i = 0; i < fourCount; i++) ratings.push(4);
      for (let i = 0; i < threeCount; i++) ratings.push(3);
      for (let i = 0; i < twoCount; i++) ratings.push(2);

      // Shuffle
      ratings.sort(() => Math.random() - 0.5);
      const names = [...INDIAN_NAMES].sort(() => Math.random() - 0.5);

      const reviews = [];
      const now = Date.now();
      const usedComments = new Set();

      for (let i = 0; i < count; i++) {
        const rating = ratings[i];
        const pool = templates[rating] || CATEGORY_TEMPLATES.general[rating] || CATEGORY_TEMPLATES.general[5];
        let comment = pool[i % pool.length];
        let attempts = 0;
        while (usedComments.has(comment) && attempts < pool.length) {
          comment = pool[(i + attempts) % pool.length];
          attempts++;
        }
        usedComments.add(comment);

        const daysAgo = 3 + (i * 3) + (i % 4);
        const createdAt = new Date(now - (daysAgo * 86400000)).toISOString();
        const id = makeSeedId(product.id, i + 1);

        reviews.push({
          id: id,
          product_id: catalogType === 'main' ? product.id : null,
          sarojini_product_id: catalogType === 'sarojini' ? product.id : null,
          catalog_type: catalogType,
          user_id: null,
          user_name: names[i % names.length],
          rating: rating,
          comment: comment,
          status: 'approved',
          created_at: createdAt,
          updated_at: createdAt
        });
      }

      // Upsert into Supabase reviews
      const { error: insErr } = await client.from("reviews").upsert(reviews, { onConflict: "id" });
      if (insErr) throw insErr;

      // Recalculate stats
      return await this.syncStats(product.id, catalogType);
    },

    clearSeededReviews: async function (productId, catalogType = 'main') {
      const client = window.AdminAuth ? window.AdminAuth.getClient() : window.supabaseClient;
      if (!client || !productId) throw new Error("Database client or product ID missing");

      const col = catalogType === 'sarojini' ? 'sarojini_product_id' : 'product_id';

      // Delete only records starting with 00005eed-
      const { error: delErr } = await client
        .from("reviews")
        .delete()
        .eq(col, productId)
        .gte("id", "00005eed-0000-0000-0000-000000000000")
        .lte("id", "00005eed-ffff-ffff-ffff-ffffffffffff");

      if (delErr) throw delErr;

      return await this.syncStats(productId, catalogType);
    },

    syncStats: async function (productId, catalogType = 'main') {
      const client = window.AdminAuth ? window.AdminAuth.getClient() : window.supabaseClient;
      const col = catalogType === 'sarojini' ? 'sarojini_product_id' : 'product_id';
      const table = catalogType === 'sarojini' ? 'sarojini_products' : 'products';

      const { data: approvedReviews, error: qErr } = await client
        .from("reviews")
        .select("rating")
        .eq(col, productId)
        .eq("status", "approved");

      if (qErr) throw qErr;

      const count = approvedReviews ? approvedReviews.length : 0;
      let avg = 0.0;
      if (count > 0) {
        const sum = approvedReviews.reduce((acc, r) => acc + (Number(r.rating) || 5), 0);
        avg = Number((sum / count).toFixed(1));
      }

      await client
        .from(table)
        .update({ rating: avg, review_count: count })
        .eq("id", productId);

      return { rating: avg, count: count };
    }
  };

  window.AdminReviewSeeder = AdminReviewSeeder;
})();

const fs = require('fs');
const path = require('path');

// Category definitions with colors and display names
// Map from CSV category name patterns to display config
const categoryConfig = {
  // Main categories - match by partial name
  'Cháo': { id: 1, color: '#F5E6D3', displayName: 'Cháo', emoji: '🥣' },
  'Bánh mì': { id: 2, color: '#D4A84B', displayName: 'Bánh mì', emoji: '🥖' },
  'Banh Mi': { id: 2, color: '#D4A84B', displayName: 'Bánh mì', emoji: '🥖' },
  'Mì Quảng': { id: 3, color: '#E8B923', displayName: 'Mì Quảng', emoji: '🍜' },
  'Bánh xèo': { id: 4, color: '#F0C75E', displayName: 'Bánh xèo', emoji: '🥞' },
  'Cao Lầu': { id: 5, color: '#8B6914', displayName: 'Cao Lầu', emoji: '🍝' },
  'Nem lui': { id: 6, color: '#A0522D', displayName: 'Nem lui', emoji: '🍢' },
  'Xôi mặn': { id: 7, color: '#9B59B6', displayName: 'Xôi', emoji: '🍚' },
  'Xoi man': { id: 7, color: '#9B59B6', displayName: 'Xôi', emoji: '🍚' },
  'Bánh Bèo': { id: 8, color: '#E8B4B8', displayName: 'Bánh Bèo/Nậm/Lọc', emoji: '🥟' },
  'Bún bò Huế': { id: 9, color: '#C0392B', displayName: 'Bún bò Huế', emoji: '🍜' },
  'Bún chả cá': { id: 10, color: '#5DADE2', displayName: 'Bún chả cá', emoji: '🐟' },
  'Bún chả': { id: 11, color: '#6D4C41', displayName: 'Bún chả', emoji: '🥩' },
  'Hủ tiếu': { id: 12, color: '#D7CCC8', displayName: 'Hủ tiếu Nam Vang', emoji: '🍜' },
  'Bún mắm': { id: 13, color: '#795548', displayName: 'Bún mắm', emoji: '🍲' },
  'Bò né': { id: 14, color: '#E67E22', displayName: 'Bò né', emoji: '🥩' },
  'Cháo Vịt': { id: 15, color: '#8D6E63', displayName: 'Cháo Vịt', emoji: '🦆' },
  'Bánh Tráng Cuốn': { id: 16, color: '#ECEFF1', displayName: 'Bánh Tráng Cuốn', emoji: '🌯' },
  'Phở': { id: 17, color: '#F39C12', displayName: 'Phở', emoji: '🍜' },
  'Cơm gà Tam Kỳ': { id: 18, color: '#F1C40F', displayName: 'Cơm gà Tam Kỳ', emoji: '🍗' },
  'Cơm gà': { id: 19, color: '#FFEB3B', displayName: 'Cơm gà', emoji: '🐔' },
  'Cơm tấm': { id: 20, color: '#D7B98E', displayName: 'Cơm tấm', emoji: '🍚' },
  'Xôi gà xé': { id: 21, color: '#E6D5B8', displayName: 'Xôi gà xé', emoji: '🍚' },
  'Bánh tráng kẹp': { id: 22, color: '#BCAAA4', displayName: 'Bánh tráng kẹp', emoji: '🫓' },
  'Cơm niêu': { id: 23, color: '#A1887F', displayName: 'Cơm niêu', emoji: '🥘' },
  'Lẩu': { id: 24, color: '#E74C3C', displayName: 'Lẩu', emoji: '🍲' },
  'Bún thịt nướng': { id: 25, color: '#E57373', displayName: 'Bún thịt nướng', emoji: '🍜' },
  'Bò lá lốt': { id: 26, color: '#27AE60', displayName: 'Bò lá lốt', emoji: '🥬' },
  'Bún riêu': { id: 27, color: '#FF7043', displayName: 'Bún riêu', emoji: '🦀' },
  'Bánh Canh': { id: 28, color: '#FFF8E1', displayName: 'Bánh Canh', emoji: '🍜' },
  'Bánh Căn': { id: 29, color: '#FFAB91', displayName: 'Bánh Căn', emoji: '🥞' },
  'Banh Can': { id: 29, color: '#FFAB91', displayName: 'Bánh Căn', emoji: '🥞' },
  'Seafood': { id: 30, color: '#3498DB', displayName: 'Hải Sản', emoji: '🦐' },
  'Cheaper local seafood': { id: 31, color: '#48C9B0', displayName: 'Hải Sản Bình Dân', emoji: '🐚' },
  'Vịt quay': { id: 32, color: '#DC7633', displayName: 'Vịt quay', emoji: '🦆' },
  'Da Nang Michelin': { id: 33, color: '#E84A27', displayName: 'Michelin Selected', emoji: '⭐' },
  'Ca Phe': { id: 34, color: '#6F4E37', displayName: 'Cà Phê', emoji: '☕' }
};

// Function to parse CSV line (handles quoted fields)
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

// Function to extract district from address
function extractDistrict(address) {
  const districts = ['Hải Châu', 'Thanh Khê', 'Sơn Trà', 'Ngũ Hành Sơn', 'Liên Chiểu', 'Cẩm Lệ', 'Hòa Vang'];
  for (const district of districts) {
    if (address && address.includes(district)) {
      return district;
    }
  }
  return 'Đà Nẵng';
}

// Function to parse rating
function parseRating(reviewStr) {
  if (!reviewStr) return { rating: 0, reviewCount: 0 };
  const match = reviewStr.match(/(\d+\.?\d*)\s*\(([0-9,]+)\)/);
  if (match) {
    return {
      rating: parseFloat(match[1]),
      reviewCount: parseInt(match[2].replace(',', ''), 10)
    };
  }
  return { rating: 0, reviewCount: 0 };
}

// Main processing
const csvDir = path.join(__dirname, 'restaurant_category_csv');
const features = [];
let idCounter = 1;

// Read all directories
const directories = fs.readdirSync(csvDir);

directories.forEach(dir => {
  const dirPath = path.join(csvDir, dir);
  if (fs.statSync(dirPath).isDirectory()) {
    // Find CSV file in directory
    const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.csv'));

    files.forEach(file => {
      const filePath = path.join(dirPath, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n').filter(l => l.trim());

      // Skip header
      for (let i = 1; i < lines.length; i++) {
        const fields = parseCSVLine(lines[i]);
        if (fields.length < 6) continue;

        const [category, name, mapsLink, coordinates, review, address, openingTime] = fields;

        // Parse coordinates (format: "lon,lat,0")
        const coordParts = coordinates.replace(/"/g, '').split(',');
        if (coordParts.length < 2) continue;

        const lon = parseFloat(coordParts[0]);
        const lat = parseFloat(coordParts[1]);

        // Skip invalid coordinates
        if (isNaN(lon) || isNaN(lat) || lon < 107 || lon > 109 || lat < 15 || lat > 17) {
          console.log(`Skipping invalid coords: ${name} - ${coordinates}`);
          continue;
        }

        // Get category config - try multiple matching strategies
        let config = null;

        // First try exact match
        if (categoryConfig[category]) {
          config = categoryConfig[category];
        } else {
          // Try partial match from config keys
          for (const key of Object.keys(categoryConfig)) {
            if (category.includes(key) || key.includes(category.split(' -')[0])) {
              config = categoryConfig[key];
              break;
            }
          }
        }

        // Special handling for specific categories by folder name patterns
        if (!config) {
          if (dir.includes('Bánh mì') || dir.includes('Banh mi')) config = categoryConfig['Bánh mì'];
          else if (dir.includes('Xôi mặn') || dir.includes('Xoi man')) config = categoryConfig['Xôi mặn'];
          else if (dir.includes('Cơm niêu')) config = categoryConfig['Cơm niêu'];
          else if (dir.includes('Lẩu')) config = categoryConfig['Lẩu'];
          else if (dir.includes('Bánh Căn') || dir.includes('Banh Can')) config = categoryConfig['Bánh Căn'];
          else if (dir.includes('Bún chả cá')) config = categoryConfig['Bún chả cá'];
          else if (dir.includes('Bún chả') && !dir.includes('cá')) config = categoryConfig['Bún chả'];
          else if (dir.includes('Ca Phe') || dir.includes('Cà Phê')) config = categoryConfig['Ca Phe'];
          else if (dir.includes('Vịt quay') || category.includes('roast duck')) config = categoryConfig['Vịt quay'];
        }

        // Fallback
        if (!config) {
          config = { id: 99, color: '#888888', displayName: category.split(' -')[0], emoji: '🍴' };
          console.log(`No config for category: ${category} (dir: ${dir})`);
        }

        const { rating, reviewCount } = parseRating(review);

        features.push({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [lon, lat]
          },
          properties: {
            id: `restaurant-${String(idCounter++).padStart(3, '0')}`,
            name: name,
            category: config.displayName,
            categoryId: config.id,
            categoryColor: config.color,
            categoryEmoji: config.emoji,
            district: extractDistrict(address),
            address: address,
            rating: rating,
            reviewCount: reviewCount,
            openingHours: openingTime || 'n/a',
            mapsLink: mapsLink
          }
        });
      }
    });
  }
});

// Create categories array - deduplicate by id
const categoriesMap = new Map();
Object.values(categoryConfig).forEach(value => {
  if (!categoriesMap.has(value.id)) {
    const count = features.filter(f => f.properties.categoryId === value.id).length;
    if (count > 0) {
      categoriesMap.set(value.id, {
        id: value.id,
        name: value.displayName,
        color: value.color,
        emoji: value.emoji,
        count: count
      });
    }
  }
});
const categories = Array.from(categoriesMap.values()).sort((a, b) => a.id - b.id);

// Output
const output = `// Restaurant data for Da Nang Food Guide - Auto-generated
// Total restaurants: ${features.length}
// Categories: ${categories.length}

const restaurantData = {
  type: "FeatureCollection",
  features: ${JSON.stringify(features, null, 2)},
  categories: ${JSON.stringify(categories, null, 2)},
  totalCount: ${features.length}
};

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = restaurantData;
}
`;

// Write to file
fs.writeFileSync(path.join(__dirname, 'js', 'restaurant-data.js'), output, 'utf-8');
console.log(`Generated restaurant-data.js with ${features.length} restaurants in ${categories.length} categories`);

// Also output summary
console.log('\nCategory summary:');
categories.forEach(c => {
  console.log(`  ${c.emoji} ${c.name}: ${c.count} restaurants`);
});

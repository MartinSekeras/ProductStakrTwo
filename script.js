document.getElementById('calculateBtn').addEventListener('click', calculateBoxes);

async function calculateBoxes() {
  const palletType = document.getElementById('palletType').value;
  let palletWidth, palletLength, palletMaxHeight;

  // Pallet dimensions based on selection
  switch(palletType) {
    case 'singleRack':
      palletWidth = 1000;
      palletLength = 1200;
      palletMaxHeight = 1700;
      break;
    case 'doubleRack':
      palletWidth = 1000;
      palletLength = 2400;
      palletMaxHeight = 1700;
      break;
    case 'mezz':
      palletWidth = 1300;
      palletLength = 2700;
      palletMaxHeight = 1700;
      break;
  }

  const boxW = parseInt(document.getElementById('boxWidth').value,10);
  const boxL = parseInt(document.getElementById('boxLength').value,10);
  const boxH = parseInt(document.getElementById('boxHeight').value,10);
  const boxWeight = parseInt(document.getElementById('boxWeight').value,10);

  const overhangWidth = parseInt(document.getElementById('overhangWidth').value,10) || 0;
  const overhangLength = parseInt(document.getElementById('overhangLength').value,10) || 0;
  const overhangHeight = parseInt(document.getElementById('overhangHeight').value,10) || 0;
  const weightOverload = parseInt(document.getElementById('weightOverload').value,10) || 0;
  
  const maxWeight = 500 + weightOverload;

  // Adjust dimensions based on overhang
  const adjWidth = palletWidth + overhangWidth;
  const adjLength = palletLength + overhangLength;
  const adjMaxHeight = palletMaxHeight + overhangHeight;

  const orientations = [
    [boxW, boxL, boxH],
    [boxW, boxH, boxL],
    [boxL, boxW, boxH],
    [boxL, boxH, boxW],
    [boxH, boxW, boxL],
    [boxH, boxL, boxW]
  ];

  const initialSpace = {x:0, y:0, z:0, w:adjWidth, l:adjLength, h:adjMaxHeight};

  const resultEl = document.getElementById('result');
  resultEl.textContent = "Calculating...";

  // Run single product calculation
  const singleResult = runCalculationForProduct(orientations, initialSpace, maxWeight, boxWeight);

  // Check if a file is uploaded
  const fileInput = document.getElementById('fileInput');
  let multiProductsResult = "";
  if (fileInput.files.length > 0) {
    const file = fileInput.files[0];
    // Parse Excel file
    const products = await parseExcelFile(file);

    if (products.length > 0) {
      let totalBoxes = 0;
      let rows = [];
      for (let prod of products) {
        const {W,L,H,Weight} = prod;
        const prodOrientations = [
          [W, L, H],
          [W, H, L],
          [L, W, H],
          [L, H, W],
          [H, W, L],
          [H, L, W]
        ];
        const prodSpace = {x:0, y:0, z:0, w:adjWidth, l:adjLength, h:adjMaxHeight};
        const count = runCalculationForProduct(prodOrientations, prodSpace, maxWeight, Weight);
        totalBoxes += count;

        rows.push(`<tr>
          <td style="border: 1px solid #ccc; padding: 8px;">${W}</td>
          <td style="border: 1px solid #ccc; padding: 8px;">${L}</td>
          <td style="border: 1px solid #ccc; padding: 8px;">${H}</td>
          <td style="border: 1px solid #ccc; padding: 8px;">${Weight}</td>
          <td style="border: 1px solid #ccc; padding: 8px;">${count}</td>
        </tr>`);
      }

      let tableHTML = `
        <h3>Multiple Products (from Excel)</h3>
        <table style="border-collapse: collapse; margin-top: 10px;">
          <thead>
            <tr>
              <th style="border: 1px solid #ccc; padding: 8px;">Width</th>
              <th style="border: 1px solid #ccc; padding: 8px;">Length</th>
              <th style="border: 1px solid #ccc; padding: 8px;">Height</th>
              <th style="border: 1px solid #ccc; padding: 8px;">Weight</th>
              <th style="border: 1px solid #ccc; padding: 8px;">Boxes</th>
            </tr>
          </thead>
          <tbody>
            ${rows.join('')}
          </tbody>
        </table>
        <p style="margin-top: 10px;">Total boxes from file: ${totalBoxes}</p>
      `;

      multiProductsResult = tableHTML;
    } else {
      multiProductsResult = "<p>No valid products found in the uploaded Excel file.</p>";
    }
  }

  // Display results
  resultEl.innerHTML = `<p>Single product result: ${singleResult} boxes.</p>${multiProductsResult}`;
}

// Re-usable calculation function for a single product
function runCalculationForProduct(orientations, initialSpace, maxWeight, boxWeight) {
  function canFit(space, fw, fl, fh) {
    return (fw <= space.w && fl <= space.l && fh <= space.h);
  }

  function placeBox(space, fw, fl, fh) {
    const newSpaces = [];
    if (fh < space.h) {
      newSpaces.push({x:space.x, y:space.y, z:space.z+fh, w:space.w, l:space.l, h:space.h-fh});
    }
    if (fl < space.l) {
      newSpaces.push({x:space.x, y:space.y+fl, z:space.z, w:space.w, l:space.l-fl, h:fh});
    }
    if (fw < space.w) {
      newSpaces.push({x:space.x+fw, y:space.y, z:space.z, w:space.w-fw, l:fl, h:fh});
    }
    return {count:1, newSpaces};
  }

  function packBoxes(spaces, orientationOrder, maxWeight, boxWeight) {
    let boxCount = 0;
    let totalWeight = 0;

    function pickSpace() {
      if (spaces.length === 0) return null;
      let maxArea = 0;
      let chosenIndex = -1;
      for (let i=0; i<spaces.length; i++) {
        const area = spaces[i].w * spaces[i].l;
        if (area > maxArea) {
          maxArea = area;
          chosenIndex = i;
        }
      }
      const sp = spaces[chosenIndex];
      spaces.splice(chosenIndex, 1);
      return sp;
    }

    let space;
    while ((space = pickSpace()) !== null) {
      let placed = false;
      for (let i=0; i<orientationOrder.length && !placed; i++) {
        const [fw, fl, fh] = orientationOrder[i];
        if (canFit(space, fw, fl, fh)) {
          if (totalWeight + boxWeight <= maxWeight) {
            const result = placeBox(space, fw, fl, fh);
            boxCount += result.count;
            totalWeight += boxWeight;
            spaces = spaces.concat(result.newSpaces);
            placed = true;
          }
        } else if (canFit(space, fl, fw, fh)) {
          if (fw !== fl && (totalWeight + boxWeight <= maxWeight)) {
            const result = placeBox(space, fl, fw, fh);
            boxCount += result.count;
            totalWeight += boxWeight;
            spaces = spaces.concat(result.newSpaces);
            placed = true;
          }
        }
      }
    }

    return boxCount;
  }

  const perms = allPermutations(orientations);
  let bestCount = 0;
  for (let p=0; p<perms.length; p++) {
    const attemptSpaces = [ {...initialSpace} ];
    const count = packBoxes(attemptSpaces, perms[p], maxWeight, boxWeight);
    if (count > bestCount) {
      bestCount = count;
    }
  }

  return bestCount;
}

function allPermutations(arr) {
  if (arr.length <= 1) return [arr];
  let perms = [];
  for (let i = 0; i < arr.length; i++) {
    let rest = arr.slice(0,i).concat(arr.slice(i+1));
    let subPerms = allPermutations(rest);
    for (let sp of subPerms) {
      perms.push([arr[i]].concat(sp));
    }
  }
  return perms;
}

// Parse Excel file using SheetJS
function parseExcelFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = function(e) {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, {type: 'array'});
      const firstSheet = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheet];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, {header:1});

      // Expecting headers: Width, Length, Height, Weight
      const headers = jsonData[0].map(h => h.toString().trim().toLowerCase());
      const wIndex = headers.indexOf('width');
      const lIndex = headers.indexOf('length');
      const hIndex = headers.indexOf('height');
      const weightIndex = headers.indexOf('weight');

      if (wIndex < 0 || lIndex < 0 || hIndex < 0 || weightIndex < 0) {
        alert("Excel file must have columns: Width, Length, Height, Weight");
        return resolve([]);
      }

      let products = [];
      for (let i=1; i<jsonData.length; i++) {
        const row = jsonData[i];
        const W = parseFloat(row[wIndex]||0);
        const L = parseFloat(row[lIndex]||0);
        const H = parseFloat(row[hIndex]||0);
        const Weight = parseFloat(row[weightIndex]||0);
        if (W>0 && L>0 && H>0 && Weight>0) {
          products.push({W,L,H,Weight});
        }
      }

      resolve(products);
    };
    reader.onerror = function(e) {
      reject(e);
    };
    reader.readAsArrayBuffer(file);
  });
}
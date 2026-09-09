require('dotenv').config({ path: '.env.local' });
const ExcelJS = require('exceljs');

// Get orders #2907-#2921 from SALIDAS
const TARGET = ['#2907','#2908','#2909','#2910','#2911','#2912','#2913','#2914','#2915','#2916','#2917','#2918','#2919','#2920','#2921'];

async function main() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile('C:/Users/Luch1/Downloads/FULLVAPO.xlsx');
  const ws = workbook.getWorksheet('SALIDAS DE STOCK');

  const orders = {};
  ws.eachRow((row) => {
    const r = row.values.slice(1); // exceljs index starts at 1, slice removes leading undefined
    if (r[2] === '2026' && r[3] === 'Marzo') {
      const orderNum = r[0];
      if (TARGET.includes(orderNum)) {
        const sku = r[5];
        const flavor = r[6];
        const qty = r[7];
        const customer = r[8];
        const cost = r[9];
        const totalCost = r[10];
        const salePrice = r[11];
        const totalSale = r[12];

        if (!orders[orderNum]) orders[orderNum] = { customer, items: [], totalCost: 0, totalSale: 0, dateSerial: r[1] };
        orders[orderNum].items.push({ sku, flavor, qty, cost, salePrice, totalSale: totalSale || 0 });
        orders[orderNum].totalCost += (totalCost || 0);
        orders[orderNum].totalSale += (totalSale || 0);
      }
    }
  });

  TARGET.forEach(num => {
    const ord = orders[num];
    if (!ord) { console.log(num, 'NOT FOUND'); return; }
    console.log(`\n${num} - ${ord.customer} (serial ${ord.dateSerial})`);
    console.log(`  Total: $${ord.totalSale.toFixed(2)} USD | COGS: $${ord.totalCost.toFixed(2)}`);
    ord.items.forEach(i => console.log(`  ${i.sku} x${i.qty} @$${i.salePrice} = $${i.totalSale}`));
  });
}

main().catch(console.error);

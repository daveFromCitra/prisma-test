const json2xls = require('json2xls');
const fs = require('fs');

// Function to convert JSON to Excel
function convertJsonToExcelSort(jsonData, batchId) {
  if (!jsonData || jsonData.length === 0) {
    console.error('JSON data is empty or invalid.');
    return;
  }
  // Define column names for Excel sheet
  const columns = {
    'Full Name': 'Full Name',
    'Street Name 1': 'Street Name 1',
    'Street Name 2': 'Street Name 2',
    'Street Name 3': 'Street Name 3',
    'City': 'City',
    'Province': 'Province',
    'ZIP': 'ZIP',
    'Id': 'Id'
  };

  // Specify data to be written to Excel sheet
  const data = [];
  jsonData.forEach(item => {
    const row = {
      'Full Name': item.shipToName,
      'Street Name 1': item.shipToAddressLine1,
      'Street Name 2': item.shipToAddressLine2,
      'Street Name 3': item.shipToAddressLine3,
      'City': item.shipToAddressTown,
      'Province': item.shipToAddressState,
      'ZIP': item.shipToAddressZipCode,
      'Id': item.id

    };
    data.push(row);
  });

  // Convert JSON to Excel
  const xls = json2xls(data, {fields: columns});
  fs.writeFileSync(`${batchId}.xlsx`, xls, 'binary');

  console.log('Excel sheet created successfully!');
}

module.exports = {
  convertJsonToExcelSort
};

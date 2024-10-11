function validateFileType(file) {
    const fileExtension = file.name.split('.').pop().toLowerCase();
    return fileExtension === 'csv';
}

async function generateForecast() {
    const monthInput = document.getElementById('monthInput').value;
    const vegetableSelect = document.getElementById('vegetableSelect').value;
    const fileInput = document.getElementById('fileInput').files[0];

    if (!monthInput) {
        alert('กรุณาเลือกเดือนและปี');
        return;
    }
    if (!vegetableSelect) {
        alert('กรุณาเลือกชื่อผัก');
        return;
    }
    if (!fileInput) {
        alert('กรุณาอัปโหลดไฟล์');
        return;
    }

    if (!validateFileType(fileInput)) {
        alert('ไฟล์ที่อัปโหลดต้องเป็นนามสกุล .csv เท่านั้น');
        return;
    }

    const formData = new FormData();
    formData.append('month', monthInput);
    formData.append('vegetable', vegetableSelect);
    formData.append('file', fileInput);

    // แสดงหน้าโหลด
    document.getElementById('loadingIndicator').style.display = 'block';

    // เพิ่มการตั้งค่า timeout (30 วินาที) ด้วย AbortController
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // ตั้งเวลา 30 วินาที

    try {
        const response = await fetch("https://deploy-fastapi-b3beaf65e792.herokuapp.com/", {
            method: 'POST',
            body: formData,
            signal: controller.signal // ใช้ AbortController ในคำขอ
        });

        clearTimeout(timeoutId); // เคลียร์ timeout เมื่อคำขอสำเร็จ

        if (!response.ok) {
            const errorText = await response.text(); // รับข้อความ error
            alert('Error with your file, Please check again');
            console.error('Network response was not ok:', errorText);
            return;
        }
        
        const forecastData = await response.json();
        console.log('Forecast data:', forecastData); // Logging the data from API for debugging

        // ดึงค่าที่ทำนายจาก predicted_sales[0][monthIndex]
        const monthIndex = new Date(monthInput).getMonth(); // Index ของเดือน (0-11)
        const predictedSales = forecastData.predicted_sales[0][monthIndex]; // ดึงค่าจาก predicted_sales

        // ตรวจสอบว่ามีข้อมูลการทำนายหรือไม่
        if (predictedSales != null) {
            // ปัดเศษค่าที่ดึงมา
            const roundedSales = Math.round(predictedSales); // ปัดเศษค่าที่ดึงมา
            
            // อัปเดตค่า predictedSales ที่ <span id="predicted-weight">
            document.getElementById('predicted-weight').innerText = roundedSales; // ใช้ค่าที่ปัดเศษ
            document.getElementById('prediction-result').style.display = 'block'; // แสดงกรอบผลลัพธ์
        }

        // เรียกใช้ฟังก์ชันการคำนวณกำหนดการปลูก
        calculatePlantingSchedule(forecastData, vegetableSelect);
    } catch (error) {
        if (error.name === 'AbortError') {
            alert('คำขอหมดเวลา กรุณาลองใหม่'); // ข้อความแจ้งเตือนเมื่อเกิด timeout
            console.error('Request timeout: ', error);
        } else {
            console.error('Error:', error);
        }
    } finally {
        // ซ่อนหน้าโหลดหลังการประมวลผล
        document.getElementById('loadingIndicator').style.display = 'none';
    }
}

function getPlantsPerKg(vegetableType, month) {
    const plantsPerKg = {
        "Frillice": { may: 12, june: 10, default: 7 },
        "GreenOak": { may: 12, june: 10, default: 7 },
        "RedCoral": { may: 13, june: 11, default: 8 },
        "RedOak": { may: 13, june: 11, default: 8 }
    };

    if (month === 5) {
        return plantsPerKg[vegetableType].may; // May
    } else if (month === 6) {
        return plantsPerKg[vegetableType].june; // June
    } else {
        return plantsPerKg[vegetableType].default; // Other months
    }
}

function calculatePlantingSchedule(data, vegetable) {
    const growthTimes = {
        'RedOak': { seeding: 7, transplanting: 35, harvesting: 1 },
        'GreenOak': { seeding: 7, transplanting: 35, harvesting: 1 },
        'RedCoral': { seeding: 7, transplanting: 35, harvesting: 1 },
        'Frillice': { seeding: 7, transplanting: 35, harvesting: 1 }
    };

    const vegetableGrowth = growthTimes[vegetable];
    if (!vegetableGrowth) {
        console.error('Invalid vegetable selected');
        return;
    }

    const seedingTime = vegetableGrowth.seeding;
    const transplantingTime = vegetableGrowth.transplanting;
    const harvestingTime = vegetableGrowth.harvesting;

    const monthIndex = new Date(document.getElementById('monthInput').value).getMonth(); // Get month index (0-11)

    // ดึงข้อมูลการคาดการณ์จาก predicted_sales
    const predictedSales = data.predicted_sales[0][monthIndex]; // ดึงข้อมูลจากเดือนที่เลือก (0-11)
    
    // ถ้าค่า predictedSales ไม่ใช่ตัวเลข (undefined หรือ null)
 
        // ตรวจสอบว่ามีข้อมูลการทำนายหรือไม่
    if (predictedSales === null || predictedSales === undefined) {
        alert('ไม่มีข้อมูลการทำนายสำหรับเดือนนี้'); // แสดง alert
        console.error('No predicted sales data for the selected month');
        return;
    }

    if (predictedSales === "Error occurred while predicting.") {
        alert('เกิดข้อผิดพลาดในการคาดการณ์'); // แสดง alert
        console.error(predictedSales); // แสดงข้อความ error ใน console
        return;
    }

    // คำนวณจำนวนพืชที่ต้องการ
    const quantityForWeek = Math.ceil(predictedSales / 3);

    const month = monthIndex + 1;
    const plantsPerKg = getPlantsPerKg(vegetable, month); // ดึงจำนวนพืชต่อกิโลกรัม

    // คำนวณจำนวนพืชทั้งหมดที่ต้องการ
    const totalRequiredPlants = Math.ceil(quantityForWeek * plantsPerKg); // คำนวณจำนวนพืชทั้งหมด

    // สร้างวันที่เริ่มต้นจากข้อมูลเดือนที่ป้อน
    const startDate = new Date(document.getElementById('monthInput').value + '-01');

    const plantingSchedule = [];
    // ลูปสำหรับการปลูก 3 รอบ (ทุก 10 วัน)
    for (let i = 0; i < 3; i++) {
        const roundStartDate = new Date(startDate);
        roundStartDate.setDate(roundStartDate.getDate() + i * 10); // ตั้งแต่เริ่มปลูกห่างกัน 10 วัน

        // วันที่เริ่มเก็บเกี่ยวจะถูกคำนวณจากการบวก 42 วันจาก roundStartDate
        const harvestDate = new Date(roundStartDate);
        harvestDate.setDate(harvestDate.getDate() - 42); // วันเริ่มเก็บเกี่ยวคือ 42 วันหลังจากการเพาะเมล็ด

        // วันที่เริ่มลงแปลงจะถูกคำนวณจากการนับถอยหลัง 35 วันจาก harvestDate
        const transplantDate = new Date(roundStartDate); 
        transplantDate.setDate(transplantDate.getDate() - 35); 

        plantingSchedule.push({
            week: i + 1,
            quantity: totalRequiredPlants, // จำนวนที่คำนวณได้
            startDate: roundStartDate, // วันเริ่มเพาะเมล็ด
            transplantDate: transplantDate, // วันเริ่มปลูก
            harvestDate: harvestDate // วันเริ่มเก็บเกี่ยว
        });
    }

    // แสดงตารางการปลูก
    displayForecast(plantingSchedule);
}

function displayForecast(data) {
    document.getElementById('forecastResult').style.display = "block";
    const tableContainer = document.getElementById('forecastResult');
    tableContainer.innerHTML = ''; // Clear previous data

    const table = document.createElement('table');
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';

    // Create table header
    const headerRow = document.createElement('tr');
    const headers = ['Round', 'Quantity of plants', 'Seeding date', 'Transplanting date', 'Harvest date'];
    headers.forEach(headerText => {
        const th = document.createElement('th');
        th.style.border = '1px solid #000';
        th.style.padding = '10px';
        th.style.backgroundColor = '#f2f2f2';
        th.textContent = headerText;
        headerRow.appendChild(th);
    });
    table.appendChild(headerRow);

    // Populate table rows with data
    data.forEach(forecast => {
        const row = document.createElement('tr');
        const values = [forecast.week, forecast.quantity, forecast.harvestDate.toDateString(), forecast.transplantDate.toDateString(), forecast.startDate.toDateString()];
        values.forEach(value => {
            const td = document.createElement('td');
            td.style.border = '1px solid #000';
            td.style.padding = '10px';
            td.textContent = value;
            row.appendChild(td);
        });
        table.appendChild(row);
    });

    // Append table to the container
    tableContainer.appendChild(table);

    // Create and append planting info below the table
    const plantingInfo = document.createElement('div');
    plantingInfo.style.marginTop = '20px';
    plantingInfo.style.textAlign = 'center';
    plantingInfo.innerHTML = `<span style="color: gray;">* Frillice, GreenOak 1 kg approximately 7 plants and RedCoral, RedOak 1 kg approximately 8 plants *</span>`;
    tableContainer.appendChild(plantingInfo);
}

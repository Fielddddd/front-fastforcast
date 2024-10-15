function validateFileType(file) {
    const fileExtension = file.name.split('.').pop().toLowerCase();
    return fileExtension === 'csv';
}

async function generateForecast() {
    const monthInput = document.getElementById('monthInput').value;
    const vegetableSelect = document.getElementById('vegetableSelect').value;
    const fileInput = document.getElementById('fileInput').files[0];

    const selectedDate = new Date(monthInput);
    const currentDate = new Date();


    if (selectedDate < new Date(currentDate.getFullYear(), currentDate.getMonth(), 1) ||
        (selectedDate.getFullYear() === currentDate.getFullYear() && 
        selectedDate.getMonth() === currentDate.getMonth() && 
        currentDate.getDate() > 1)) {
        alert('ไม่สามารถเลือกเดือนที่ผ่านมาแล้วได้!');
        return;
    }

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


    document.getElementById('loadingIndicator').style.display = 'block';

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
        const response = await fetch("https://deploy-fastapi-b3beaf65e792.herokuapp.com/upload_csv", {
            method: 'POST',
            body: formData,
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorText = await response.text();
            alert('Error with your file, Please check again');
            console.error('Network response was not ok:', errorText);
            return;
        }
        
        const forecastData = await response.json();
        console.log('Forecast data:', forecastData); 

        const monthIndex = new Date(monthInput).getMonth();
        const predictedSales = forecastData.predicted_sales[0][monthIndex]; 

        if (predictedSales != null) {

            const roundedSales = Math.round(predictedSales);
            
            document.getElementById('predicted-weight').innerText = roundedSales;
            document.getElementById('prediction-result').style.display = 'block';
        }

        calculatePlantingSchedule(forecastData, vegetableSelect);
    } catch (error) {
        if (error.name === 'AbortError') {
            alert('คำขอหมดเวลา กรุณาลองใหม่');
            console.error('Request timeout: ', error);
        } else {
            console.error('Error:', error);
        }
    } finally {

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
        return plantsPerKg[vegetableType].may;
    } else if (month === 6) {
        return plantsPerKg[vegetableType].june;
    } else {
        return plantsPerKg[vegetableType].default;
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

    const monthIndex = new Date(document.getElementById('monthInput').value).getMonth(); 

    const predictedSales = data.predicted_sales[0][monthIndex]; 
    
    if (predictedSales === null || predictedSales === undefined) {
        alert('ไม่มีข้อมูลการทำนายสำหรับเดือนนี้'); 
        console.error('No predicted sales data for the selected month');
        return;
    }

    if (predictedSales === "Error occurred while predicting.") {
        alert('เกิดข้อผิดพลาดในการคาดการณ์'); 
        console.error(predictedSales); 
        return;
    }

    const quantityForWeek = Math.ceil(predictedSales / 3);

    const month = monthIndex + 1;
    const plantsPerKg = getPlantsPerKg(vegetable, month);

    const totalRequiredPlants = Math.ceil(quantityForWeek * plantsPerKg); 

    const startDate = new Date(document.getElementById('monthInput').value + '-01');

    const plantingSchedule = [];

    for (let i = 0; i < 3; i++) {
        const roundStartDate = new Date(startDate);
        roundStartDate.setDate(roundStartDate.getDate() + i * 10);

        const harvestDate = new Date(roundStartDate);
        harvestDate.setDate(harvestDate.getDate() - 42);

        const transplantDate = new Date(roundStartDate); 
        transplantDate.setDate(transplantDate.getDate() - 35); 

        plantingSchedule.push({
            week: i + 1,
            quantity: totalRequiredPlants, 
            startDate: roundStartDate, 
            transplantDate: transplantDate,
            harvestDate: harvestDate
        });
    }

    displayForecast(plantingSchedule);
}

function displayForecast(data) {
    document.getElementById('forecastResult').style.display = "block";
    const tableContainer = document.getElementById('forecastResult');
    tableContainer.innerHTML = '';

    const table = document.createElement('table');
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';

    const headerRow = document.createElement('tr');
    const headers = ['Round', 'Quantity of plants (ea.)', 'Seeding date', 'Transplanting date', 'Harvest date'];
    headers.forEach(headerText => {
        const th = document.createElement('th');
        th.style.border = '1px solid #000';
        th.style.padding = '10px';
        th.style.backgroundColor = '#f2f2f2';
        th.textContent = headerText;
        headerRow.appendChild(th);
    });
    table.appendChild(headerRow);

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

    tableContainer.appendChild(table);

    const plantingInfo = document.createElement('div');
    plantingInfo.style.marginTop = '20px';
    plantingInfo.style.textAlign = 'center';
    plantingInfo.innerHTML = `<span style="color: gray;">* Frillice, GreenOak 1 kg approximately 7 plants and RedCoral, RedOak 1 kg approximately 8 plants *</span>`;
    tableContainer.appendChild(plantingInfo);
}

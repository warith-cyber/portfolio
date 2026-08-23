// Update the diameter value display
document.getElementById('diameter').addEventListener('input', function() {
    document.getElementById('diameterValue').textContent = this.value + ' cm';
});

// =====================================
// total tree based on location barchart
// ======================================

// Dummy Data for Bar Chart
const data = {
    alltype: [267, 250, 23, 17],
    mahogany: [10, 20, 30, 0],
    buchida: [15, 25, 35, 45],
    angsana: [5, 15, 25, 35],
    leopard: [56, 54, 67, 59],
    adenanthera: [23, 45, 65, 30],
    ironwood: [40, 50, 30, 20],
    tecoma: [20, 30, 40, 10],
    musk_tree: [12, 18, 8, 5],
    jambu_laut: [8, 10, 5, 3],
    kopsia_singapurensis: [6, 8, 4, 2],
    callistemon: [10, 12, 6, 4],
    arfiuella: [7, 9, 5, 3],
    tabebuia: [9, 11, 7, 4],
    mimusops: [5, 7, 3, 2],
};

// Bar Chart Initialization - FIXED SELECTOR
const ctx = document.querySelector('.chart').getContext('2d');
let myBarChart = new Chart(ctx, {
    type: 'bar',
    data: {
        labels: ['All', 'Roadside', 'House Area', 'Other'],
        datasets: [{
            label: 'Total tree distribution',
            data: data["alltype"],
            backgroundColor: 'rgba(75, 192, 192, 0.2)',
            borderColor: 'rgba(75, 192, 192, 1)',
            borderWidth: 1
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            y: {
                beginAtZero: true
            }
        }
    }
});

// Function to Update Chart Data Based on Filter - FIXED PARAMETER ISSUE
function updateChartData() {
    const treeType = document.getElementById('treeType').value;

    let newData;
    switch(treeType) {
        case 'mahogany':
            newData = data['mahogany'];
            break;
        case 'buchida':
            newData = data['buchida'];
            break;
        case 'angsana':
            newData = data['angsana'];
            break;
        case 'leopard':
            newData = data['leopard'];
            break;
        case 'adenanthera':
            newData = data['adenanthera'];
            break;
        case 'ironwood':
            newData = data['ironwood'];
            break;
        case 'tecoma':
            newData = data['tecoma'];
            break;
        case 'musk_tree':
            newData = data['musk_tree'];
            break;
        case 'jambu_laut':
            newData = data['jambu_laut'];
            break;
        case 'kopsia_singapurensis':
            newData = data['kopsia_singapurensis'];
            break;
        case 'callistemon':
            newData = data['callistemon'];
            break;
        case 'arfiuella':
            newData = data['arfiuella'];
            break;
        case 'tabebuia':
            newData = data['tabebuia'];
            break;
        case 'mimusops':
            newData = data['mimusops'];
            break;
        default:
            newData = data['alltype'];
    }
    myBarChart.data.datasets[0].data = newData;
    myBarChart.update();
}
    
    
// ===================
// CO2 Chart
// ===================

// Dummy Data for CO2 Absorption based on Tree Type, Location, and Diameter Range
const CO2_data = {
    all: [100, 200, 300, 101, 213, 150, 51, 126, 234, 324, 123, 324, 125, 214], 
    roadside: [20, 30, 20, 10, 50, 50, 80, 80, 40, 10, 48, 10, 40, 14],
    housing: [40, 30, 20, 10, 50, 40, 30, 50, 20, 50, 20, 54, 56, 38],
    other: [4, 2, 4, 6, 7, 8, 9, 10, 8, 7, 5, 3, 1, 5]
};

// Pie Chart Initialization - FIXED SELECTOR
const ctx2 = document.getElementById('pieChart').getContext('2d');
let myPieChart = new Chart(ctx2, {
    type: 'pie',
    data: {
        labels: ['Mahogany', 'Bhucida', 'Angsana', 'Leopard tree', 'Adenanthera', 'Ironwood', 'Tecoma', 'Musk tree', 'Jambu Laut', 'Kopsia singapurensis', 'Callistemon citrunus', 'Arfeuillea arborescens', 'Tabebuia crysantha', 'Mimusops elengi'],
        datasets: [{
            label: 'CO2 Absorption by Location',
            data: CO2_data['all'],
            backgroundColor: [
                '#a75728', // Mahogany
                '#ffc107', // Bhucida
                '#007bff', // Angsana
                '#28a745', // Leopard tree
                '#6f427f', // Adenanthera
                '#e83e8c', // Ironwood
                '#17a2b8', // Tecoma
                '#fd7e14', // Musk tree
                '#6c757d', // Jambu Laut
                '#20c997', // Kopsia singapurensis
                '#343a40', // Callistemon
                '#dc3545', // Arfeuillea
                '#0000ff', // Tabebuia
                '#ff00ff'  // Mimusops
            ],
            borderColor: '#ffffff',
            borderWidth: 2
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'right'
            }
        }
    }
});

// Function to Get CO2 Absorption Data for Pie Chart - FIXED PARAMETER ISSUE
function getCO2Data() {
    const location = document.getElementById('location').value;
    
    let co2Data;

    // Determine CO2 absorption based on location
    switch(location) {
        case 'Roadside':
            co2Data = CO2_data['roadside'];
            break;
        case 'Housing':  // FIXED: Changed from 'HouseArea' to 'Housing'
            co2Data = CO2_data['housing'];
            break;
        case 'other':
            co2Data = CO2_data['other'];
            break;
        default:
            co2Data = CO2_data['all'];
    }
    
    myPieChart.data.datasets[0].data = co2Data;
    myPieChart.update();
}
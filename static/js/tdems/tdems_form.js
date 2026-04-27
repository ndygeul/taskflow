function removeRow(btn) { btn.closest('.input-group').remove(); }

function addIpRow() {
    const container = document.getElementById('ip-container');
    const div = document.createElement('div');
    div.className = 'input-group mb-1';
    div.innerHTML = `<input type="text" name="ip[]" class="form-control" placeholder="예: 10.1.23.45">
                        <button type="button" class="btn btn-outline-danger" onclick="removeRow(this)">-</button>`;
    container.appendChild(div);
}

function addSpecRow(type, placeholder) {
    const container = document.getElementById(type + '-container');
    const div = document.createElement('div');
    div.className = 'input-group mb-2';
    let unitSelect = (type === 'ssd' || type === 'hdd') ? `<select name="${type}_unit[]" class="form-select" style="max-width: 80px;"><option>GB</option><option>TB</option></select>` : '';
    div.innerHTML = `<input type="text" name="${type}_capacity[]" class="form-control" placeholder="${placeholder}">${unitSelect}<input type="number" name="${type}_qty[]" class="form-control" placeholder="수량" value="1"><button type="button" class="btn btn-outline-danger" onclick="removeRow(this)">-</button>`;
    container.appendChild(div);
}

function initCustomSelect(selectId, inputId) {
    const select = document.getElementById(selectId);
    const input = document.getElementById(inputId);
    const currentVal = input.value;

    let exists = false;
    for (let i = 0; i < select.options.length; i++) {
        if (select.options[i].value === currentVal) {
            exists = true;
            select.value = currentVal;
            break;
        }
    }
    if (currentVal && !exists) {
        select.value = "DIRECT";
        input.style.display = "block";
    } else if (!currentVal) {
        select.value = "";
        input.style.display = "none";
    }
}

function syncSelect(selectEl, inputId) {
    const input = document.getElementById(inputId);
    if (selectEl.value === 'DIRECT') {
        input.value = ''; 
        input.style.display = 'block';
        input.focus();
    } else {
        input.value = selectEl.value;
        input.style.display = 'none';
    }
}

document.addEventListener("DOMContentLoaded", function() {
    initCustomSelect('sel_purpose', 'purpose');
    initCustomSelect('sel_own_team', 'own_team');
    initCustomSelect('sel_standard', 'standard_service');
    initCustomSelect('sel_unit', 'unit_service');
    initCustomSelect('sel_asset_type', 'asset_type');
    initCustomSelect('sel_manufacturer', 'manufacturer');
});
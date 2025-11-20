// --- Data & Templates ---
const bodyRegions = ["Torso", "Upper Extremity", "Lower Extremity"];
const bodyPartsByRegion = {
    Torso: ["Head", "Facial", "Neck", "Thorax", "Abdomen", "Upper Back", "Lower Back", "Pelvis"],
    "Upper Extremity": ["Shoulder", "Upper Arm", "Elbow", "Forearm", "Wrist", "Hand", "Finger"],
    "Lower Extremity": ["Hip", "Thigh", "Knee", "Lower Leg", "Ankle", "Foot", "Toe"],
};
const injuryTypes = ["Abrasion", "Contusion", "Laceration", "Swelling", "Deformity", "Avulsion", "Fracture", "Burn", "Puncture wound", "Skin defect", "Pain but no open wound", "Crush injury"];

const chartTemplate = `1. Trauma History
Mechanism:
Energy:
Contamination:
Wound over:
ps: all the wound exactly generate from wound record and in bullet form.
No limited joint Range of motion: ps: default setting is free walking or free movement according to the wound record.

No ILOC, no nasuea, no vomiting , no dizziness, no diplopia
No neck pain, no chest pain, no dyspnea, no abdominal pain, no limb weakness or numbness

2. PE: 
Clear consciousness, E4V5M6
HEENT:
No hematoma, no otorrhea, no racoon's eye, no battle's sign
Chest:
No open wound
bilateral clear breathing sound, no decreasing breathing sound.
Abdomen:
No open wound
Soft abdomen with no tenderness
Stable pelvic gridle with no tenderness.
Limb:
No limited active ROM.
Patent distal perfusion, no cyanosis
Neurological:
GCS: E4V5M6, clear consciousness
well orientation
Muscle power:
RUL/LUL:5/5
RLL/LLL:5/5
DTR: RUL/LUL:++/++ RLL/LLL:++/++
No Numbness, No paresthesia
Babinski sign: Bilateral plantar reflex`;

const mainPromptInstructions = `Please analyze the chief complaint and wound i key in. then stay strictly to the form “trauma history” in the file”Trauma History and PE.txt”.
The wound form is generate from "wound record" on the webpage.

Review and avoid paradox in the chart.
(Exp: chest pain , but key in no chest pain in negative finding)

truama present illness should present strict to my form:(
Mechanism:(Should in english and clear: Example: Scooter driver collision with car with left elbow contusion this morning.)
Energy: 
Contamination:(+: if dirty contact , machine crush)
Wound:
- all the wound exactly generate from wound record and in bullet form.
Range of motion: 
Add associates symptoms in orininal compaint. 
)
present PE according to PE on “Trauma History and PE.txt”.
Automatically add wound present in the history then add in to my PE finding according to body parts. history and PE should relate with my chief complaint
avoid paradox or unreasonable finding history in PE.
All notes should present in english`;

// --- State ---
let woundRecordObjects = [];
let woundDescriptionCounter = 0;

// --- Functions defined in global scope ---
function showAlert(message) {
    $('#custom-alert-message').text(message);
    $('#custom-alert-modal').removeClass("hidden");
}

function showConfirm(message) {
    return new Promise((resolve) => {
        $('#custom-confirm-message').text(message);
        $('#custom-confirm-modal').removeClass("hidden");
        const onConfirm = () => cleanup(true);
        const onCancel = () => cleanup(false);
        function cleanup(result) {
            $("#custom-confirm-ok").off("click", onConfirm);
            $("#custom-confirm-cancel").off("click", onCancel);
            $('#custom-confirm-modal').addClass("hidden");
            resolve(result);
        }
        $("#custom-confirm-ok").on("click", onConfirm);
        $("#custom-confirm-cancel").on("click", onCancel);
    });
}

function populateBodyRegionSelect() {
    bodyRegions.forEach(region => $("#body-region-select").append(`<option value="${region}">${region}</option>`));
}

function updateSpecificBodyPartSelect() {
    const selectedRegion = $("#body-region-select").val();
    const $specificBodyPartSelect = $("#specific-body-part-select");
    $specificBodyPartSelect.html('<option value="Select Part">Select Part</option>').prop("disabled", true);
    if (selectedRegion !== 'Select Region' && bodyPartsByRegion[selectedRegion]) {
        bodyPartsByRegion[selectedRegion].forEach(part => $specificBodyPartSelect.append(`<option value="${part}">${part}</option>`));
        $specificBodyPartSelect.prop("disabled", false);
    }
}

function populateInjuryRadios() {
    const $injuryTypeRadiosContainer = $("#injury-type-radios");
    $injuryTypeRadiosContainer.empty();
    
    injuryTypes.forEach((type) => {
        const label = `<label class="wound-type-label text-base font-medium leading-normal flex items-center justify-center rounded-xl border border-[#d0dee7] px-4 h-11 text-[#0e161b] relative cursor-pointer">
                        <input type="radio" name="injury-type" value="${type}" class="absolute opacity-0 w-0 h-0">
                        <span class="flex items-center justify-center w-full h-full">${type}</span>
                    </label>`;
        $injuryTypeRadiosContainer.append(label);
    });
}

function addWoundDescriptionField() {
    woundDescriptionCounter++;
    const fieldHtml = `<div class="flex flex-col w-full" id="wound-desc-field-${woundDescriptionCounter}">
            <label class="text-base font-medium leading-normal text-[#0e161b]">Wound Description ${woundDescriptionCounter}:</label>
            <textarea placeholder="Add notes related to the wound" class="form-input w-full min-w-0 flex-1 resize-none overflow-hidden rounded-xl text-[#0e161b] focus:outline-0 focus:ring-0 border border-[#d0dee7] bg-slate-50 focus:border-[#d0dee7] min-h-16 placeholder:text-[#4e7a97] p-[15px] text-base font-normal leading-normal"></textarea>
        </div>`;
    $("#wound-description-fields").append(fieldHtml);
}

function updateWoundRecordsDisplay() {
    const $woundRecordsDisplay = $("#wound-records-display");
    $woundRecordsDisplay.empty();
    if (woundRecordObjects.length === 0) {
         $woundRecordsDisplay.html('<div class="p-2">No records added yet.</div>');
         return;
    }
    woundRecordObjects.forEach((record, index) => {
        let content;
        if (record.isEditing) {
            content = `
                <input type="text" value="${record.displayText.replace(/^- /, "").trim()}" class="edit-input flex-grow form-input rounded-md border-gray-300 shadow-sm">
                <div class="flex-shrink-0 edit-actions">
                    <button class="save-record-btn text-green-500 ml-2 px-2" data-index="${index}">Save</button>
                    <button class="delete-record-btn text-red-500 ml-2 px-2" data-index="${index}">Delete</button>
                </div>
            `;
        } else {
             content = `
                <span class="flex-grow">${record.displayText.trim()}</span>
                <div class="flex-shrink-0">
                   <button class="edit-record-btn text-blue-500 ml-4 px-2" data-index="${index}">Edit</button>
                   <button class="delete-record-btn text-red-500 ml-2 px-2" data-index="${index}">Delete</button>
                </div>
            `;
        }
        const recordEl = $(`
            <div class="record-item flex items-center justify-between py-1 px-2" id="record-item-${index}">
                ${content}
            </div>
        `);
        $woundRecordsDisplay.append(recordEl);
    });
}

function getMappedQuery(query) {
    let mappedQuery = query;
    mappedQuery = mappedQuery.replace(/Swelling/gi, 'contusion');
    mappedQuery = mappedQuery.replace(/pain but no open wound/gi, 'contusion');
    mappedQuery = mappedQuery.replace(/deformity/gi, 'other injury');
    mappedQuery = mappedQuery.replace(/Skin defect/gi, 'open wound');
    mappedQuery = mappedQuery.replace(/Crush injury/gi, 'open wound');
    return mappedQuery;
}

async function searchNihIcd10Api(query) {
    let searchTerms = getMappedQuery(query).replace(/^- /, "").trim();
    if (searchTerms.toLowerCase().includes('head')) {
       searchTerms = searchTerms.replace(/head/i, 'unspecified part of head');
    }
     if (searchTerms.toLowerCase().includes('fracture')) {
       searchTerms += " non-displaced";
    }
    searchTerms += " initial encounter";
    const url = `https://clinicaltables.nlm.nih.gov/api/icd10cm/v3/search?sf=code,name&terms=${encodeURIComponent(searchTerms)}`;
    try {
        const response = await fetch(url);
        if (!response.ok) return null;
        const data = await response.json();
        if (data && data[3] && data[3].length > 0) {
            const firstResult = data[3][0];
            return `${firstResult[0]} - ${firstResult[1]}`;
        }
        return null;
    } catch (error) {
        console.error("NIH API Error:", error);
        return null;
    }
}

async function getIcd10ForMultipleRecords(recordsToQuery, apiKey) {
    if (recordsToQuery.length === 0) return [];
    const promptText = recordsToQuery.map((record, index) => `${index + 1}. ${getMappedQuery(record.displayText.trim())}`).join('\n');
    const prompt = `For each numbered wound description below, provide the most likely ICD-10 code and its official short name for an initial encounter. Assume fractures are non-displaced unless specified otherwise. Respond only with a numbered list in the format: "1. CODE - NAME". Important: When "head" is mentioned, it refers to the anatomical head (cranial region), not the head of an organ like the pancreas.if "chest" is mentioned, it refers to thorax, not breast.If you cannot find a code, respond with "Not Found".\n\n${promptText}`;
    try {
        const chatHistory = [{ role: "user", parts: [{ text: prompt }] }];
        const payload = { contents: chatHistory };
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;
        
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
           const errorBody = await response.text();
           console.error("API Error Response:", errorBody);
           return recordsToQuery.map(() => "Gemini API Error");
        }
        
        const result = await response.json();
        if (result.candidates && result.candidates[0]?.content?.parts[0]?.text) {
            const textResponse = result.candidates[0].content.parts[0].text.trim();
            const lines = textResponse.split('\n');
            const results = new Array(recordsToQuery.length).fill("Parsing Error");

            lines.forEach(line => {
                const match = line.match(/^(\d+)\.\s*(.*)/);
                if (match) {
                    const geminiIndex = parseInt(match[1], 10) - 1;
                    const content = match[2];
                    if (geminiIndex >= 0 && geminiIndex < results.length) {
                        results[geminiIndex] = content;
                    }
                }
            });
             return results;
        }
        return recordsToQuery.map(() => "Parsing Error or Not Found");
    } catch (error) {
        console.error("Gemini API Call Failed:", error);
        return recordsToQuery.map(() => "Network or API Call Error");
    }
}

 async function getIcd10FromComplaint(complaint, apiKey) {
    if (!complaint) return null;
    const prompt = `Analyze the following patient's chief complaint. Identify potential ICD-10 codes for the MECHANISM of injury (e.g., falls, traffic accidents, bites) and any mentioned UNDERLYING DISEASES (e.g., diabetes, hypertension). DO NOT identify codes for the wounds themselves.
Important Rules:
1. Respond only with the findings in the format: "ICD-10: CODE - NAME".
2. If multiple diagnoses are found, list each on a new line.
3. If no relevant mechanism or disease is found, respond with "No additional diagnoses found."
4. Always assume it's an initial encounter.

Chief Complaint: "${complaint}"`;
     try {
        const chatHistory = [{ role: "user", parts: [{ text: prompt }] }];
        const payload = { contents: chatHistory };
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;
        
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) return "Gemini API Error for Chief Complaint.";
        const result = await response.json();
        if (result.candidates && result.candidates[0]?.content?.parts[0]?.text) {
             const text = result.candidates[0].content.parts[0].text.trim();
             return text.toLowerCase() === "no additional diagnoses found." ? null : text;
        }
        return null;
    } catch (error) {
        console.error("Gemini API Call for Complaint Failed:", error);
        return "Network or API Call Error for Chief Complaint.";
    }
}

async function generateChartNote() {
    const apiKey = $("#api-key-input").val().trim();
    if (!apiKey) {
        showAlert("Please enter your Gemini API Key before generating a chart.");
        return;
    }
    const chiefComplaint = $("#chief-complaint").val().trim();
    const woundRecordsText = woundRecordObjects.map(r => r.displayText.trim()).join('\n');

    if (!chiefComplaint) {
        showAlert("Please enter a chief complaint before generating the chart.");
        return;
    }

     $("#loading-indicator").removeClass("hidden");
     $("#final-chart-display").val("Generating Chart Note...");

    const finalPrompt = `${mainPromptInstructions}

### CHIEF COMPLAINT:
${chiefComplaint}

### WOUND RECORDS:
${woundRecordsText}

### FORMAT TEMPLATE TO USE:
---
${chartTemplate}
---

Now, generate the complete and consistent chart note based on all the provided information.`;

    try {
         const chatHistory = [{ role: "user", parts: [{ text: finalPrompt }] }];
        const payload = { contents: chatHistory };
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;
        
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

         if (!response.ok) {
           const errorBody = await response.text();
           throw new Error(`API Error: ${errorBody}`);
        }

        const result = await response.json();
        if (result.candidates && result.candidates[0]?.content?.parts[0]?.text) {
            $("#final-chart-display").val(result.candidates[0].content.parts[0].text.trim());
        } else {
             $("#final-chart-display").val("Failed to generate chart. The API returned an empty response.");
        }

    } catch (error) {
        console.error("Chart Generation Failed:", error);
        $("#final-chart-display").val(`An error occurred while generating the chart: ${error.message}`);
    } finally {
         $("#loading-indicator").addClass("hidden");
    }

}

$(document).ready(function() {
// --- Event Handlers ---
$("#body-region-select").on("change", updateSpecificBodyPartSelect);
$("#add-another-wound-description-btn").on("click", addWoundDescriptionField);
$("#custom-alert-ok").on("click", () => $('#custom-alert-modal').addClass("hidden"));


$("#add-wound-record-btn").on("click", function() {
    const side = $('input[name="side-type"]:checked').val();
    const bodyRegion = $("#body-region-select").val();
    const specificBodyPart = $("#specific-body-part-select").val();
    const injuryType = $('input[name="injury-type"]:checked').val();
    const woundDescriptions = $("#wound-description-fields").find("textarea").map((_, el) => $(el).val().trim()).get().filter(d => d);

    if (!side || bodyRegion === "Select Region" || specificBodyPart === "Select Part" || !injuryType) {
        showAlert("Please ensure Side, Body Region, Specific Part, and an Injury Type are selected!");
        return;
    }

    let finalDisplayPart = specificBodyPart;
    if (side !== "N/A") finalDisplayPart = `${side} ${specificBodyPart}`;
    const descriptions = woundDescriptions.length > 0 ? `, ${woundDescriptions.join(", ")}` : "";
    
    const recordObject = {
        displayText: `- ${finalDisplayPart} ${injuryType}${descriptions}\n`
    };
    woundRecordObjects.push(recordObject);
    updateWoundRecordsDisplay();
    
    $("#wound-description-fields").empty();
    woundDescriptionCounter = 0;
    addWoundDescriptionField();
});

$('#add-custom-entry-btn').on('click', function() {
     const newRecord = {
        displayText: '- ',
        isEditing: true
    };
    woundRecordObjects.push(newRecord);
    updateWoundRecordsDisplay();
    $(`#record-item-${woundRecordObjects.length - 1} .edit-input`).focus();
});

$("#wound-records-display").on('click', '.edit-record-btn', function() {
    const index = $(this).data('index');
    woundRecordObjects[index].isEditing = true;
    updateWoundRecordsDisplay();
    $(`#record-item-${index} .edit-input`).focus();
});

$("#wound-records-display").on('click', '.delete-record-btn', function() {
    const index = $(this).data('index');
    woundRecordObjects.splice(index, 1);
    updateWoundRecordsDisplay();
});

$("#wound-records-display").on('click', '.save-record-btn', function() {
    const index = $(this).data('index');
    const newText = $(`#record-item-${index} .edit-input`).val().trim();
    woundRecordObjects[index].displayText = (newText.startsWith('-') ? newText : `- ${newText}`) + '\n';
    woundRecordObjects[index].isEditing = false;
    updateWoundRecordsDisplay();
});

$("#generate-icd-btn").on("click", async function() {
    const apiKey = $("#api-key-input").val().trim();
    if (!apiKey) {
        showAlert("Please enter your Gemini API Key before generating ICD-10 codes.");
        return;
    }
    if (woundRecordObjects.length === 0 && !$("#chief-complaint").val().trim()) {
        showAlert("Please add at least one wound record or a chief complaint first.");
        return;
    }
    $("#loading-indicator").removeClass("hidden");
    $("#final-report-display").text("Generating & Verifying..."); // 更新提示訊息

    // Process wound records
    let finalReportEntries = new Array(woundRecordObjects.length);
    const nihPromises = woundRecordObjects.map(record => searchNihIcd10Api(record.displayText));
    const nihResults = await Promise.all(nihPromises);
    let recordsForGemini = [];
    let geminiIndexMap = [];
    nihResults.forEach((result, index) => {
        if (result) {
            finalReportEntries[index] = `ICD-10: ${result}\n`;
        } else {
            recordsForGemini.push(woundRecordObjects[index]);
            geminiIndexMap.push(index);
        }
    });

    // 如果有需要 Gemini 處理的紀錄
    if (recordsForGemini.length > 0) {
        // 1. 先從 Gemini 獲取初步結果
        const geminiResults = await getIcd10ForMultipleRecords(recordsForGemini, apiKey);

        // 2. 準備對 Gemini 的結果進行二次驗證
        const verificationPromises = geminiResults.map(geminiResult => {
            // 如果 Gemini 回傳錯誤或找不到，直接回傳原始錯誤訊息
            if (!geminiResult || geminiResult.includes("Error") || geminiResult.includes("Not Found")) {
                return Promise.resolve(geminiResult);
            }

            // 從 "CODE - NAME" 格式中提取 NAME 部分
            const parts = geminiResult.split(' - ');
            const description = parts.length > 1 ? parts.slice(1).join(' - ').trim() : geminiResult.trim();

            // 如果成功提取出描述，就用它來查詢 NIH API
            if (description) {
                return searchNihIcd10Api(description);
            } else {
                // 如果無法提取，則返回原始 Gemini 結果
                return Promise.resolve(geminiResult);
            }
        });
        
        // 3. 等待所有二次驗證的查詢完成
        const verifiedResults = await Promise.all(verificationPromises);

        // 4. 整理最終結果
        verifiedResults.forEach((finalResult, i) => {
            const originalIndex = geminiIndexMap[i];
            // 如果二次驗證成功 (finalResult 不為 null)，就使用驗證後的結果
            // 否則，退回使用 Gemini 的原始結果作為備案，並加上標記
            if (finalResult) {
                finalReportEntries[originalIndex] = `ICD-10: ${finalResult}\n`;
            } else {
                finalReportEntries[originalIndex] = `ICD-10: ${geminiResults[i]} ##\n`;
            }
        });
    }

    // Process chief complaint
    const chiefComplaintText = $("#chief-complaint").val().trim();
    const complaintIcdResult = await getIcd10FromComplaint(chiefComplaintText, apiKey);

    let verifiedComplaintIcdResult = "";
    if (complaintIcdResult && complaintIcdResult.toLowerCase() !== "no additional diagnoses found.") {
        const lines = complaintIcdResult.split('\n');
        const verificationPromises = lines.map(async line => {
            if (line.includes("ICD-10:")) {
                const parts = line.split(' - ');
                const description = parts.length > 1 ? parts.slice(1).join(' - ').trim() : '';
                if (description) {
                    const verified = await searchNihIcd10Api(description);
                    if (verified) {
                        return `ICD-10: ${verified}`;
                    }
                }
                return `${line} ##`; // Add marker if not verifiable
            }
            return line;
        });
        const verifiedLines = await Promise.all(verificationPromises);
        verifiedComplaintIcdResult = verifiedLines.join('\n');
    }


    let combinedReport = "--- Wound Record Diagnoses ---\n";
    combinedReport += finalReportEntries.filter(Boolean).join("") || "No specific wound diagnoses generated.\n";
    if (verifiedComplaintIcdResult) {
        combinedReport += "\n--- Chief Complaint Related Diagnoses ---\n";
        combinedReport += `${verifiedComplaintIcdResult}\n`;
    }

    $("#final-report-display").text(combinedReport);
    $("#loading-indicator").addClass("hidden");
});

$('#generate-chart-btn').on('click', generateChartNote);

$("#clear-all-records-btn").on("click", async function() {
    const confirmed = await showConfirm("Are you sure you want to clear all records? This action cannot be undone.");
    if (confirmed) {
        woundRecordObjects = [];
        updateWoundRecordsDisplay();
        $("#final-report-display").text("Click \"Generate ICD-10\" after adding records.");
         $("#final-chart-display").val("");
         $("#chief-complaint").val("");
        $('input[name="side-type"]:checked').prop('checked', false);
        $("#body-region-select").val("Select Region");
        updateSpecificBodyPartSelect();
        $('input[name="injury-type"]:checked').prop('checked', false);
    }
});

$("#copy-records-btn").on("click", function() {
    const reportText = woundRecordObjects.map(r => r.displayText.trim()).join("\n");
    if (!reportText) {
        showAlert("There are no wound records to copy.");
        return;
    }
    const tempTextArea = document.createElement("textarea");
    tempTextArea.value = reportText;
    document.body.appendChild(tempTextArea);
    tempTextArea.select();
    tempTextArea.setSelectionRange(0, 99999);
    try {
        document.execCommand('copy');
        showAlert("Wound records have been copied to clipboard!");
    } catch (err) {
        console.error("Copy failed: ", err);
        showAlert("Failed to copy records. Please try again or copy manually.");
    } finally {
        document.body.removeChild(tempTextArea);
    }
});

$("#copy-chart-btn").on("click", function() {
    const chartText = $("#final-chart-display").val();
     if (!chartText) {
        showAlert("There is no chart to copy.");
        return;
    }
    const tempTextArea = document.createElement("textarea");
    tempTextArea.value = chartText;
    document.body.appendChild(tempTextArea);
    tempTextArea.select();
    tempTextArea.setSelectionRange(0, 99999);
    try {
        document.execCommand('copy');
        showAlert("Chart note has been copied to clipboard!");
    } catch (err) {
        console.error("Copy failed: ", err);
        showAlert("Failed to copy chart. Please try again or copy manually.");
    } finally {
        document.body.removeChild(tempTextArea);
    }
});

// --- Initial Setup ---
populateBodyRegionSelect();
populateInjuryRadios();
addWoundDescriptionField();
updateWoundRecordsDisplay();
});

const fs = require('fs');
const cheerio = require('cheerio');

/**
 * Improved HTML to JSON converter for UCAB schedule data
 * Extracts data from HTML tables and converts to JSON format
 */
class HTMLToJSONConverter {
    constructor() {
        this.htmlFiles = ['table-copy-1.html', 'table-copy-2.html'];
        this.outputFile = 'generado.json';
        this.debugMode = true;
        this.tableSelector = '#tablepress-temp-horarios-tentativos-202525';
        this.rowSelector = 'tbody tr';
    }

    /**
     * Read and parse HTML files from local directory
     */
    readHTMLFiles() {
        const allData = [];

        for (const fileName of this.htmlFiles) {
            if (fs.existsSync(fileName)) {
                console.log(`Processing ${fileName}...`);
                const htmlContent = fs.readFileSync(fileName, 'utf8');
                const data = this.parseHTMLTable(htmlContent);
                allData.push(...data);
                console.log(`Extracted ${data.length} records from ${fileName}`);
            } else {
                console.warn(`File ${fileName} not found, skipping...`);
            }
        }

        return allData;
    }

    /**
     * Parse HTML table and extract schedule data
     */
    parseHTMLTable(htmlContent) {
        const $ = cheerio.load(htmlContent);
        const records = [];

        // Try multiple selectors to find the table
        let table = $(this.tableSelector);

        // If not found, try alternative selectors
        if (table.length === 0) {
            table = $('.tablepress');
            if (table.length === 0) {
                table = $('table');
            }
        }

        if (table.length === 0) {
            console.warn('Schedule table not found in HTML');
            return records;
        }

        // Extract data from each row - try different tbody selectors
        let rows = table.find(this.rowSelector);
        if (rows.length === 0) {
            rows = table.find('tr').not('thead tr');
        }

        console.log(`Found ${rows.length} data rows`);

        rows.each((index, row) => {
            const $row = $(row);
            const record = this.extractRowData($row);
            if (record && record.nrc) { // Only add records with valid NRC
                records.push(record);
            }
        });

        return records;
    }

    /**
     * Extract data from a single table row
     */
    extractRowData($row) {
        try {
            // Extract data using CSS selectors for each column
            const nrc = $row.find('.column-1').text().trim();
            const codigo = $row.find('.column-2').text().trim();
            const profesor = $row.find('.column-3').text().trim();
            const asignatura = $row.find('.column-4').text().trim();
            const tax = $row.find('.column-5').text().trim();
            const mod = $row.find('.column-6').text().trim();
            const lun = $row.find('.column-7').text().trim();
            const mar = $row.find('.column-8').text().trim();
            const mie = $row.find('.column-9').text().trim();
            const jue = $row.find('.column-10').text().trim();
            const vie = $row.find('.column-11').text().trim();
            const sab = $row.find('.column-12').text().trim();
            const dom = $row.find('.column-13').text().trim();

            // Skip rows with empty NRC (invalid data)
            if (!nrc) {
                return null;
            }

            return {
                nrc: nrc,
                codigo: codigo,
                profesor: profesor || null,
                asignatura: asignatura,
                tax: tax,
                mod: mod,
                lun: lun || null,
                mar: mar || null,
                mie: mie || null,
                jue: jue || null,
                vie: vie || null,
                sab: sab || null,
                dom: dom || null
            };
        } catch (error) {
            console.error('Error extracting row data:', error);
            return null;
        }
    }

    /**
     * Save extracted data to JSON file
     */
    saveToJSON(data) {
        try {
            // Create structure similar to results.json
            const jsonStructure = {
                success: true,
                totalCount: data.length,
                data: data,
                pageMaxSize: data.length,
                pageOffset: 0,
                sectionsFetchedCount: data.length
            };
            
            const jsonData = JSON.stringify(jsonStructure, null, 2);
            // Ensure UTF-8 encoding and add BOM for better compatibility
            fs.writeFileSync(this.outputFile, jsonData, { encoding: 'utf8' });
            console.log(`Successfully saved ${data.length} records to ${this.outputFile}`);
        } catch (error) {
            console.error('Error saving JSON file:', error);
            throw error;
        }
    }

    /**
     * Main conversion process
     */
    convert() {
        console.log('Starting HTML to JSON conversion...');
        console.log('Target files:', this.htmlFiles);

        try {
            // Read and parse HTML files
            const allData = this.readHTMLFiles();

            if (allData.length === 0) {
                console.warn('No data extracted from HTML files');
                return;
            }

            // Remove duplicates based on NRC
            const uniqueData = this.removeDuplicates(allData);
            console.log(`Total unique records: ${uniqueData.length}`);

            // Save to JSON
            this.saveToJSON(uniqueData);

            console.log('Conversion completed successfully!');

        } catch (error) {
            console.error('Conversion failed:', error);
            process.exit(1);
        }
    }

    /**
     * Remove duplicate records based on NRC
     */
    removeDuplicates(data) {
        const seen = new Set();
        return data.filter(record => {
            if (seen.has(record.nrc)) {
                return false;
            }
            seen.add(record.nrc);
            return true;
        });
    }
}

// Run the converter if this file is executed directly
if (require.main === module) {
    const converter = new HTMLToJSONConverter();
    converter.convert();
}

module.exports = HTMLToJSONConverter;
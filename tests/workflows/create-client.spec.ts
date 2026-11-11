//import { test, expect, Page } from '@playwright/test';
import { test, expect } from '../fixtures/auth.fixture';

import { CreateAccountPage } from '../../pages/createAccount';
import { getWorkbookData } from '../../utils/excelReader';
import { findEntry, makeKey } from '../../utils/testResultsStore';

//helper function that loops and splits people of interest data:
function splitField(value: string | undefined): string[] {
    if (!value) return [];
    return value.split('|').map(item => item.trim());
}

const workbookData = getWorkbookData();
Object.entries(workbookData).forEach(([sheetName, rows]) => {

    test.describe(sheetName, () => {
        rows.forEach((row: any, index) => {
            test(`${row['TC-No']}`, async ({page}) => {

                // Expose row details to the PDF reporter.
                test.info().annotations.push({
                    type: 'account',
                    description: String(row['Account number'] ?? '').trim(),
                });

                const idNumber = String(row['ID number'] ?? '').trim();
                const businessReg = String(row['Business registration num'] ?? '').trim();

                test.info().annotations.push({
                    type: 'identifier',
                    description: idNumber || businessReg,
                });

                const accountNumber = String(row['Account number'] ?? '').trim();
                const resultsKey = makeKey(accountNumber, String(row['TC-No'] ?? ''));
                const previous = findEntry(resultsKey);
                if (previous && (previous.status === 'passed' || previous.status === 'duplicate')) {
                    test.skip(true, `Already '${previous.status}' in testResults.json (key: ${resultsKey})`);
                }

                switch (sheetName){
                    case 'Monthly accounts':
                        const createAccountPage = new CreateAccountPage(page, "Monthly accounts (Miscellaneous) (ZD and other Z accounts)");
                        await createAccountPage.openSystem();

                        //temporary test
                        console.log('URL after openSystem:', page.url());
                        console.log(
                            'Welcome visible:',
                            await page.getByText('Welcome to NWK,').isVisible().catch(() => false)
                        );
                        
                        //now create a client
                        await createAccountPage.createClient();
                        await createAccountPage.clientInformation(
                            row['Type of legal entity'], 
                            row['Id or registration number type'], 
                            row['Business registration num'], 
                            row['Birth/Registration date'], 
                            row['Full names / Bussiness name'], 
                            row['Language choice'], 
                            row['Marketing'], 
                            row['Correspondence'],                 
                            row['ID number'],
                            row['Title'],
                            row['Nickname'],
                            //row[''],
                            row['Surname'],
                            row['Race'],
                            row['Gender'],
                            row['Marital status'],                           
                        );                    

                        await createAccountPage.contactInformation(
                            row['Cellphone'], 
                            row['Telephone'], 
                            row['Email'], 
                            row['Street'], 
                            row['Suburb'], 
                            row['City'], 
                            row['Postal Code'], 
                            row['Postal address same as physical address'], 
                            row['Street 1'], 
                            row['Suburb 1'], 
                            row['City 1'], 
                            row['Postal Code 1']
                        );

                        await createAccountPage.businessInformation(
                            row['Tax country'], 
                            row['Income tax number'], 
                            row['VAT number'], 
                            row['Clause 7'], 
                            row['Farmer type'], 
                            row['Classified as farmer'], 
                            row['Director ward'], 
                            row['Place of business'], 
                            row['BBBEE'], 
                            row['Nearest Silo'], 
                            row['VAT auth(new)'],
                            row['VAT Category']
                        );

                        const MAtypes = splitField(row['PI_Type']);
                        const MAidTypes = splitField(row['PI_ID Type']);
                        const MAidNumbers = splitField(row['PI_ID Number']);
                        const MAnames = splitField(row['PI_Name']);
                        const MAsecondNames = splitField(row['PI_Second Name']);
                        const MAsurnames = splitField(row['PI_Surname']);
                        const MAphones = splitField(row['PI_Phone Numbers']);
                        const MAemails = splitField(row['PI_Email Addresses']);
                        const MAstreet = splitField(row['PI_Street']);
                        const MAsuburb = splitField(row['PI_Suburb']);
                        const MAcity = splitField(row['PI_City']);
                        const MApostalCode = splitField(row['PI_Postal Code']);

                        for (let i = 0; i < MAtypes.length; i++) {
                            await createAccountPage.PeopleOfInterest(
                                MAtypes[i] ?? '',
                                MAidTypes[i] ?? '',
                                MAidNumbers[i] ?? '',
                                MAnames[i] ?? '',
                                MAsecondNames[i] ?? '',
                                MAsurnames[i] ?? '',
                                MAphones[i] ?? '',
                                MAemails[i] ?? '',
                                MAstreet[i] ?? '',
                                MAsuburb[i] ?? '',
                                MAcity[i] ?? '',
                                MApostalCode[i] ?? ''
                            );
                        }
                        //FICA section:
                        if(row['Fica status'] === 'Yes'){
                            await createAccountPage.Fica(row['Fica date']);

                        }
                        //session section:
                        if(row['Session'] === "Yes"){
                            await createAccountPage.Session(row['Session date']);
                        }

                        //sundry section:
                        await createAccountPage.SandryAccount(
                            row['Order Required'],
                            row['Transport Account'],
                            row['Interest Indicator'],
                            row['Exit Indicator'],
                            row['Payment Indicator'],
                            row['Account Type'],
                            row['Statement Print'],
                            row['Account number']
                        );    

                        //enter account number:
                        await createAccountPage.enterAccountInfo(row['Account number']);               
                        //save client
                        await createAccountPage.saveClient();
                        break;

                    case 'Cash accounts (Miscellane) (ZL)':
                        const createCashAccountPage = new CreateAccountPage(page, "Cash accounts (Miscellaneous) (ZL)");
                        await createCashAccountPage.openSystem();
                        //now create a client
                        await createCashAccountPage.createClient();
                        await createCashAccountPage.clientInformation(
                            row['Type of legal entity'], 
                            row['Id or registration number type'], 
                            row['Business registration num'], 
                            row['Birth/Registration date'], 
                            row['Full names / Bussiness name'], 
                            row['Language choice'], 
                            row['Marketing'], 
                            row['Correspondence'],
                            row['ID number'],
                            row['Title'],
                            row['Nickname'],
                            //row[''],
                            row['Surname'],
                            row['Race'],
                            row['Gender'],
                            row['Marital status'],                          
                        );

                        await createCashAccountPage.contactInformation(
                            row['Cellphone'], 
                            row['Telephone'], 
                            row['Email'], 
                            row['Street'], 
                            row['Suburb'], 
                            row['City'], 
                            row['Postal Code'], 
                            row['Postal address same as physical address'], 
                            row['Street 1'], 
                            row['Suburb 1'], 
                            row['City 1'], 
                            row['Postal Code 1']
                        );

                        await createCashAccountPage.businessInformation(
                            row['Tax country'], 
                            row['Income tax number'], 
                            row['VAT number'], 
                            row['Clause 7'], 
                            row['Farmer type'], 
                            row['Classified as farmer'], 
                            row['Director ward'], 
                            row['Place of business'], 
                            row['BBBEE'], 
                            row['Nearest Silo'], 
                            row['VAT auth(new)'],
                            row['VAT Category']
                        );

                        // send data to helper function to split data in the cells:
                        const types = splitField(row['PI_Type']);
                        const idTypes = splitField(row['PI_ID Type']);
                        const idNumbers = splitField(row['PI_ID Number']);
                        const names = splitField(row['PI_Name']);
                        const secondNames = splitField(row['PI_Second Name']);
                        const surnames = splitField(row['PI_Surname']);
                        const phones = splitField(row['PI_Phone Numbers']);
                        const emails = splitField(row['PI_Email Addresses']);
                        const street = splitField(row['PI_Street']);
                        const suburb = splitField(row['PI_Suburb']);
                        const city = splitField(row['PI_City']);
                        const postalCode = splitField(row['PI_Postal Code']);

                        //loop through each person and call the person of interest:
                        for (let i = 0; i < types.length; i++) {
                            await createCashAccountPage.PeopleOfInterest(
                                types[i] ?? '',
                                idTypes[i] ?? '',
                                idNumbers[i] ?? '',
                                names[i] ?? '',
                                secondNames[i] ?? '',
                                surnames[i] ?? '',
                                phones[i] ?? '',
                                emails[i] ?? '',
                                street[i] ?? '',
                                suburb[i] ?? '',
                                city[i] ?? '',
                                postalCode[i] ?? ''
                            );
                        }

                        //FICA section:
                        if(row['Fica status'] === 'Yes'){
                            await createCashAccountPage.Fica(row['Fica date']);
                        }

                        //session section:
                        if(row['Session'] === "Yes"){
                            await createCashAccountPage.Session(row['Session date']);
                        }

                        //enter account number:
                        await createCashAccountPage.enterAccountInfo(row['Account number']);
                        await createCashAccountPage.saveClient();
                        break;

                    case "Maise account (X)":
                        const createMaiseAccountPage = new CreateAccountPage(page, "Maise supply accounts (Production) (X)");
                        await createMaiseAccountPage.openSystem();

                        //now create a client
                        await createMaiseAccountPage.createClient();
                        await createMaiseAccountPage.clientInformation(
                            row['Type of legal entity'], 
                            row['Id or registration number type'], 
                            row['Business registration num'], 
                            row['Birth/Registration date'], 
                            row['Full names / Bussiness name'], 
                            row['Language choice'], 
                            row['Marketing'], 
                            row['Correspondence'],                     
                            row['ID number'],
                            row['Title'],
                            row['Nickname'],
                            //row[''],
                            row['Surname'],
                            row['Race'],
                            row['Gender'],
                            row['Marital status'],                          
                        );


                        await createMaiseAccountPage.contactInformation(
                            row['Cellphone'], 
                            row['Telephone'], 
                            row['Email'], 
                            row['Street'], 
                            row['Suburb'], 
                            row['City'], 
                            row['Postal Code'], 
                            row['Postal address same as physical address'], 
                            row['Street 1'], 
                            row['Suburb 1'], 
                            row['City 1'], 
                            row['Postal Code 1']
                        );    

                        await createMaiseAccountPage.businessInformation(
                            row['Tax country'], 
                            row['Income tax number'], 
                            row['VAT number'], 
                            row['Clause 7'], 
                            row['Farmer type'], 
                            row['Classified as farmer'], 
                            row['Director ward'], 
                            row['Place of business'], 
                            row['BBBEE'], 
                            row['Nearest Silo'], 
                            row['VAT auth(new)'],
                            row['VAT Category']
                        );

                        // send data to helper function to split data in the cells:
                        const Mtypes = splitField(row['PI_Type']);
                        const MidTypes = splitField(row['PI_ID Type']);
                        const MidNumbers = splitField(row['PI_ID Number']);
                        const Mnames = splitField(row['PI_Name']);
                        const MsecondNames = splitField(row['PI_Second Name']);
                        const Msurnames = splitField(row['PI_Surname']);
                        const Mphones = splitField(row['PI_Phone Numbers']);
                        const Memails = splitField(row['PI_Email Addresses']);
                        const Mstreet = splitField(row['PI_Street']);
                        const Msuburb = splitField(row['PI_Suburb']);
                        const Mcity = splitField(row['PI_City']);
                        const MpostalCode = splitField(row['PI_Postal Code']);

                        //loop through each person and call the person of interest:
                        for (let i = 0; i < Mtypes.length; i++) {
                            await createMaiseAccountPage.PeopleOfInterest(
                                Mtypes[i] ?? '',
                                MidTypes[i] ?? '',
                                MidNumbers[i] ?? '',
                                Mnames[i] ?? '',
                                MsecondNames[i] ?? '',
                                Msurnames[i] ?? '',
                                Mphones[i] ?? '',
                                Memails[i] ?? '',
                                Mstreet[i] ?? '',
                                Msuburb[i] ?? '',
                                Mcity[i] ?? '',
                                MpostalCode[i] ?? ''
                            );
                        }

                        await createMaiseAccountPage.enterAccountInfo(row['Account number']);
                        await createMaiseAccountPage.saveClient();
                        break;


                    case "Production & Month account(A-S)":
                        const createPMAccountPage = new CreateAccountPage(page, "Production and monthly accounts (Production) (A to S)");
                        await createPMAccountPage.openSystem();

                        //now create a client
                        await createPMAccountPage.createClient();
                        await createPMAccountPage.clientInformation(
                            row['Type of legal entity'], 
                            row['Id or registration number type'], 
                            row['Business registration num'], 
                            row['Birth/Registration date'], 
                            row['Full names / Bussiness name'], 
                            row['Language choice'], 
                            row['Marketing'], 
                            row['Correspondence'],                     
                            row['ID number'],
                            row['Title'],
                            row['Nickname'],
                            row['Surname'],
                            row['Race'],
                            row['Gender'],
                            row['Marital status'],                          
                        );

                        await createPMAccountPage.contactInformation(
                            row['Cellphone'], 
                            row['Telephone'], 
                            row['Email'], 
                            row['Street'], 
                            row['Suburb'], 
                            row['City'], 
                            row['Postal Code'], 
                            row['Postal address same as physical address'], 
                            row['Street 1'], 
                            row['Suburb 1'], 
                            row['City 1'], 
                            row['Postal Code 1']
                        );    

                        await createPMAccountPage.businessInformation(
                            row['Tax country'], 
                            row['Income tax number'], 
                            row['VAT number'], 
                            row['Clause 7'], 
                            row['Farmer type'], 
                            row['Classified as farmer'], 
                            row['Director ward'], 
                            row['Place of business'], 
                            row['BBBEE'], 
                            row['Nearest Silo'], 
                            row['VAT auth(new)'],
                            row['VAT Category']
                        );  

                        const MPtypes = splitField(row['PI_Type']);
                        const MPidTypes = splitField(row['PI_ID Type']);
                        const MPidNumbers = splitField(row['PI_ID Number']);
                        const MPnames = splitField(row['PI_Name']);
                        const MPsecondNames = splitField(row['PI_Second Name']);
                        const MPsurnames = splitField(row['PI_Surname']);
                        const MPphones = splitField(row['PI_Phone Numbers']);
                        const MPemails = splitField(row['PI_Email Addresses']);
                        const MPstreet = splitField(row['PI_Street']);
                        const MPsuburb = splitField(row['PI_Suburb']);
                        const MPcity = splitField(row['PI_City']);
                        const MPpostalCode = splitField(row['PI_Postal Code']);

                        //loop through each person and call the person of interest:
                        for (let i = 0; i < MPtypes.length; i++) {
                            await createPMAccountPage.PeopleOfInterest(
                                MPtypes[i] ?? '',
                                MPidTypes[i] ?? '',
                                MPidNumbers[i] ?? '',
                                MPnames[i] ?? '',
                                MPsecondNames[i] ?? '',
                                MPsurnames[i] ?? '',
                                MPphones[i] ?? '',
                                MPemails[i] ?? '',
                                MPstreet[i] ?? '',
                                MPsuburb[i] ?? '',
                                MPcity[i] ?? '',
                                MPpostalCode[i] ?? ''
                            );
                        }
                   
                        await createPMAccountPage.enterAccountInfo(row['Account number'], row["Trail Balance Indicator"], row["Product Type"], row["Investors Loans"]);
                        await createPMAccountPage.saveClient();
                        break;

                    default:
                        throw new Error(`Unknown sheet name: ${sheetName}`);
                }
            })
        })
    });
});







// test('create client workflow', async ({ page }) => {



//     const createAccountPage = new CreateAccountPage(page, "Monthly accounts (Miscellaneous) (ZD and other Z accounts)");



//     await createAccountPage.openSystem();



//     //now create a client



//     await createAccountPage.createClient();



// });








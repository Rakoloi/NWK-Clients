import { Page, expect } from '@playwright/test';

export class CreateAccountPage {
    accountType: string;
    constructor(private page: Page, accountType: string) {
        this.accountType = accountType;
        console.log("Account Type: " + this.accountType);
    }

    async openSystem(){
        //await this.page.goto('https://lar-qa.nwk.co.za/auth/sign-in?redirect=/general/clients');
        //await this.page.goto('https://lar-qa.nwk.co.za/general/clients');
        
        //await this.page.pause();
        await this.page.getByRole('button', { name: 'General' }).click();
        await this.page.getByRole('button', { name: 'Clients' }).click();

        //await this.page.waitForLoadState('networkidle');
        const createClientBtn = this.page.getByRole('button', { name: 'Create Client' });
        await createClientBtn.waitFor({state: 'visible', timeout: 0});
        await createClientBtn.click({timeout: 0});
        await this.page.getByRole('combobox', { name: 'Select account type' }).click();   
    }

    async createClient(){

        await this.page.waitForLoadState('networkidle');

        await this.page.getByRole('option', { name: this.accountType }).click();

    }


    async clientInformation(TypeOfEntity: string, regNoType: string, bussRegNo: string, birthRegDate: string, bussNames: string, language: string, marketing: string, correspondence: string, IDnum: string, title: string, nickName: string, surname: string, race: string, gender: string, maritalStatus: string){


        await this.page.getByRole('combobox', { name: 'Select a legal entity type' }).click();

        await this.page.getByRole('option', { name: TypeOfEntity }).click();



        if(TypeOfEntity == 'Natural Person' || TypeOfEntity == 'Sole Proprietorship'){
            await this.page.getByRole('combobox', { name: 'Select ID or registration type' }).click();
            await this.page.getByRole('option', { name: regNoType }).click();
            await this.page.getByRole('textbox', { name: 'Enter ID number or search for' }).click();
            await this.page.getByRole('textbox', { name: 'Enter ID number or search for' }).fill(IDnum);    

            // fill date
            await this.page.evaluate((birthRegDate) => {
                const input = document.querySelector(
                    'input[placeholder="Select birth/registration date"]'
                ) as HTMLInputElement;

                const event = new Event('input', { bubbles: true });
                input.value = birthRegDate;
                input.dispatchEvent(event);
            }, birthRegDate);

            await this.page.getByRole('combobox', { name: 'Select title' }).click();
            await this.page.getByRole('option', { name: title, exact: true }).click();
            await this.page.getByRole('textbox', { name: 'Enter nickname' }).click();
            await this.page.getByRole('textbox', { name: 'Enter nickname' }).fill(nickName);
            await this.page.getByRole('textbox', { name: 'Enter first name' }).click();
            await this.page.getByRole('textbox', { name: 'Enter first name' }).fill(nickName);

            // field not required.

            // await this.page.getByRole('textbox', { name: 'Enter second name' }).click();

            // await this.page.getByRole('textbox', { name: 'Enter second name' }).fill('secon name');



            await this.page.getByRole('textbox', { name: 'Enter surname' }).click();
            await this.page.getByRole('textbox', { name: 'Enter surname' }).fill(surname);
            await this.page.getByRole('combobox', { name: 'Select race' }).click();
            await this.page.getByRole('option', { name: race }).click();
            // await this.page.pause();

            // if(TypeOfEntity != "Sole Proprietorship"){

            //     //await this.page.locator('#radix-v-0-411-form-item > .p-icon.p-select-clear-icon').click(); 

            // }
            // clear the gender field if not empty first

            const genderField = this.page.locator('[name="gender"]');
            const clearGender = genderField.locator('.p-select-clear-icon');

            if (await clearGender.isVisible()) {
                await clearGender.click();
            }

            await genderField.getByRole('combobox', { name: 'Select gender' }).click();
            await this.page.getByRole('option', { name: gender, exact: true }).click();
       
            //cash account does not have a maritial status field:

            if(this.accountType != "Cash accounts (Miscellaneous) (ZL)"){
                if(!await this.page.getByRole('combobox', { name: 'Select marital status' }).isVisible()){
                    await this.page.locator('#radix-v-0-175-form-item > .p-icon.p-select-clear-icon').click();
                }

                await this.page.getByRole('combobox', { name: 'Select marital status' }).click();
                await this.page.getByRole('option', { name: maritalStatus }).click(); 
            }
        } 

        else {
            await this.page.getByRole('combobox', { name: 'Select ID or registration type' }).click();
            await this.page.getByText(regNoType).click();

            //await this.page.pause();
            await this.page.getByRole('textbox', { name: 'Enter business registration' }).click();
            await this.page.getByRole('textbox', { name: 'Enter business registration' }).fill(bussRegNo);
            await this.page.getByRole('textbox', { name: 'Enter business name' }).click();
            await this.page.getByRole('textbox', { name: 'Enter business name' }).fill(bussNames);

            //set date
            await this.page.evaluate((birthRegDate) => {
                const input = document.querySelector(
                    'input[placeholder="Select birth/registration date"]'
                ) as HTMLInputElement;

                const event = new Event('input', { bubbles: true });
                input.value = birthRegDate;
                input.dispatchEvent(event);
            }, birthRegDate);
        }     

        if(marketing === 'Yes') {
            await this.page.locator('#marketing_preference-true-0').check();
        }else{
            //await this.page.locator('#marketing_preference-false-1').check();
        }

        if(correspondence === 'Yes') {
            await this.page.locator('#correspondence-true-0').check();
        }else{
            await this.page.locator('#correspondence-false-1').check();
        }

        if(language === 'English') {
            await this.page.locator('#language-english-1').check();
        }else{
            await this.page.locator('#language-afrikaans-0').check();
        }   
    }

    async spouseInformation(){
        await this.page.pause();
    }

    async contactInformation(cellphone: string, Telephone: string, email: string, street1: string, suburb1: string, city1: string, postalCode1: string, sameAddress: string, postStreet: string, postSuburb: string, postCity: string, postPostalCode: string){
        if(cellphone?.trim()){
            await this.page.getByRole('textbox', { name: 'Enter phone number' }).click();
            await this.page.getByRole('textbox', { name: 'Enter phone number' }).fill(cellphone);
        }

        if(Telephone?.trim()){
            await this.page.getByRole('button', { name: 'Add Another Phone Number(s)' }).click();
            await this.page.locator('#phones-1-type').getByRole('combobox', { name: 'Cellphone' }).click();
            await this.page.getByRole('option', { name: 'Telephone' }).click();
            await this.page.locator('#phones-1-value').click();
            await this.page.locator('#phones-1-value').fill(Telephone);
        }

        await this.page.getByRole('textbox', { name: 'Enter email address' }).click();
        //check if there are multiple email and split:
        if(email.includes("|")){
            //await this.page.pause();
            const emails = email.split("|").slice(0, 5); // Maximum of 5 emails;
            for (let i = 0; i < emails.length; i++){
                await this.page.locator(`#emails-${i}-value`).fill(emails[i].trim());

                // Click "Add another email" unless this is the last email
                if (i < emails.length - 1) {
                    await this.page.getByRole('button', { name: 'Add another email' }).click();
                }
            }

        }else{
            await this.page.getByRole('textbox', { name: 'Enter email address' }).fill(email);
        }

        await this.page.getByRole('textbox', { name: 'Enter street address' }).click();
        await this.page.getByRole('textbox', { name: 'Enter street address' }).fill(street1);
        await this.page.getByRole('textbox', { name: 'Enter suburb' }).click();
        await this.page.getByRole('textbox', { name: 'Enter suburb' }).fill(suburb1);
        await this.page.getByRole('textbox', { name: 'Enter city' }).click();
        await this.page.getByRole('textbox', { name: 'Enter city' }).fill(city1);
        // await this.page.pause();
        await this.page.getByRole('textbox', { name: 'Enter postal code' }).click();
        await this.page.getByRole('textbox', { name: 'Enter postal code' }).fill(postalCode1.toString());       

        if(sameAddress.toUpperCase() != 'Y'){
            // click the checkbox if address !the same.
            await this.page.getByRole('checkbox').uncheck();
            await this.page.getByRole('textbox', { name: 'Enter postal street' }).click();
            await this.page.getByRole('textbox', { name: 'Enter postal street' }).fill(postStreet);
            await this.page.getByRole('textbox', { name: 'Enter postal suburb' }).click();
            await this.page.getByRole('textbox', { name: 'Enter postal suburb' }).fill(postSuburb);
            await this.page.getByRole('textbox', { name: 'Enter postal city' }).click();
            await this.page.getByRole('textbox', { name: 'Enter postal city' }).fill(postCity);
            await this.page.locator('input[name="postal_postal_code"]').click();
            await this.page.locator('input[name="postal_postal_code"]').fill(postPostalCode.toString());
        }
    }

    async businessInformation(taxCountry: string, taxNum: string, VATnum: string, Clause7: string, FarmerType: string, classAssFarmer: string, directorWard: string, placeOfBus: string, bbbe:string, nearSilo:string, VAtAuth: string, vatCategory: string){
        await this.page.getByText('South Africa').click();
        await this.page.getByRole('option', { name: taxCountry }).click();
        await this.page.getByRole('textbox', { name: 'Enter income tax number' }).click();
        await this.page.getByRole('textbox', { name: 'Enter income tax number' }).fill(taxNum);

        // await this.page.getByRole('combobox', { name: 'February' }).click();

        // await this.page.getByRole('option', { name: 'March' }).click();
        await this.page.getByRole('textbox', { name: 'Enter VAT number' }).click();
        await this.page.getByRole('textbox', { name: 'Enter VAT number' }).fill(VATnum.toString());

        if (VATnum != '') {
            //enter the VAT flag in the VAT number is not empty
            await this.page.getByRole('textbox', { name: 'Enter VAT flag (1-9)' }).click();
            await this.page.getByRole('textbox', { name: 'Enter VAT flag (1-9)' }).fill('1');
            //select clause 7 depending on the excel choosen value, it selects no by default so lects yes conditionally

            if (Clause7 === 'Yes') {
                //await this.page.getByRole('region', { name: 'VAT Information' }).getByLabel('Yes').check();
                await this.page.locator('#clause7-true-0').click();
            }
        }

        // bbe required field
        if(bbbe?.trim()){
            await this.page.getByRole('combobox', { name: 'Select a status' }).click();
            await this.page.getByRole('option', { name: bbbe, exact: true }).click();
        }



        // VAT invoice autherisation

        //The field was removed in the system

        // await this.page.pause();

        if(this.accountType == "Maise supply accounts (Production) (X)" || this.accountType == "Production and monthly accounts (Production) (A to S)"){         
            if(VAtAuth?.trim() && VAtAuth.toLowerCase() == 'yes'){
                await this.page.locator('#vat_invoice_auth-true-0').check();
            }else if(VAtAuth?.trim() && VAtAuth.toLowerCase() == 'no'){

                await this.page.locator('#vat_invoice_auth-false-1').check(); 
            }
        }

        // select the VAT category"
        if(vatCategory?.trim()){
            await this.page.getByRole('combobox', { name: 'Select a VAT category' }).click();
            await this.page.getByRole('option', { name: vatCategory }).click();
        }



        // place of business field not required

        if(placeOfBus?.trim()){  
            //await this.page.pause();
            await this.page.getByRole('combobox', { name: 'Select a place of business' }).click({timeout: 120000});
            await this.page.getByRole('option', { name: placeOfBus, exact: true }).click({timeout: 120000});
        }    

        //director ward field not required
        if(directorWard?.trim()){          
            await this.page.getByRole('combobox', { name: 'Select an option' }).click();
            await this.page.getByRole('option', { name: directorWard }).click();
        }

        //nearest silo field not required
        if(nearSilo?.trim()){
            //console.log('nearSilo: ', nearSilo);
            await this.page.getByRole('combobox', { name: 'Select a silo' }).click();
            await this.page.getByRole('option', { name: nearSilo }).click();
        }
    }

    async PeopleOfInterest(type: string, IDtype: string, IDnumber: string, name: string, secondName: string, surname: string, phoneNum: string, email: string, street: string, suburb: string, city: string, postalCode: string){
        //await this.page.pause();
        await this.page.getByRole('button', { name: 'Add record' }).click();
        await this.page.getByRole('combobox', { name: 'Select type' }).click();
        await this.page.getByRole('option', { name: type }).click();
        await this.page.getByRole('combobox', { name: 'Select ID type' }).click();
        await this.page.getByRole('option', { name: IDtype }).click();
        await this.page.getByRole('textbox', { name: 'Enter ID number' }).click();
        await this.page.getByRole('textbox', { name: 'Enter ID number' }).fill(IDnumber);
        await this.page.getByRole('textbox', { name: 'Enter name', exact: true }).click();
        await this.page.getByRole('textbox', { name: 'Enter name', exact: true}).fill(name);
        await this.page.getByRole('textbox', { name: 'Enter surname' }).click();
        await this.page.getByRole('textbox', { name: 'Enter surname' }).fill(surname);

        //await this.page.pause();
        await this.page.getByRole('region', { name: 'Phone Numbers * (1/10)' }).getByPlaceholder('Enter phone number').click();
        await this.page.getByRole('region', { name: 'Phone Numbers * (1/10)' }).getByPlaceholder('Enter phone number').fill(phoneNum);

        if(email){
            await this.page.locator('input[name^="people_of_interest["][name$=".contact.emails[0]-value"]').fill(email);
        }

        //Enter address which is forever required
        await this.page.locator('input[name$=".addresses[0].poi_address_1"]').click();
        await this.page.locator('input[name$=".addresses[0].poi_address_1"]').fill(street);
        await this.page.locator('input[name$=".addresses[0].poi_address_2"]').click();
        await this.page.locator('input[name$=".addresses[0].poi_address_2"]').fill(suburb);
        await this.page.locator('input[name$=".addresses[0].poi_address_3"]').click();
        await this.page.locator('input[name$=".addresses[0].poi_address_3"]').fill(city);
        await this.page.locator('input[name$=".addresses[0].poi_postal_code"]').click();
        await this.page.locator('input[name$=".addresses[0].poi_postal_code"]').fill(postalCode);
        await this.page.getByRole('button', { name: 'Save changes' }).click();
    }

    async Fica(ficaDate: string){
        //set date
        await this.page.locator('#fica_status-true-0').check();
        await this.page.locator('.p-datepicker-input').last().evaluate(
            (input: HTMLInputElement, ficaDate: string) => {
                input.value = ficaDate;
                input.dispatchEvent(new Event('input', { bubbles: true }));
            },
            ficaDate
        );

        await this.page.getByRole('group', { name: 'FICA' }).locator('input[type="file"]')
            .setInputFiles('C:\\Users\\309w14\\Desktop\\windows img files\\5 Add Desktop Wallpaper.jpg');
    }

    async Session(sessionDate: string){
        await this.page.locator('#has_session-true-0').check();
        await this.page.locator('.p-datepicker-input').last().evaluate(
            (input: HTMLInputElement, sessionDate: string) => {
                input.value = sessionDate;
                input.dispatchEvent(new Event('input', { bubbles: true }));
            },
            sessionDate
        );

        await this.page.getByRole('region', { name: 'Session' }).locator('input[type="file"]')
            .setInputFiles('C:\\Users\\309w14\\Desktop\\windows img files\\5 Add Desktop Wallpaper.jpg');
    }

    //for monthly accounts and Cash accounts: 
    async SandryAccount(orderRequired: string, Transport: string, InterestIndicator: string, ExitIndicator: string, PayIndicator: string, AccType: string, StatementPrint: string, accountNum: string){    
        if(this.accountType === "Monthly accounts (Miscellaneous) (ZD and other Z accounts)"){

            if(orderRequired === 'Yes'){
                await this.page.locator('#order_required-true-0').check();
            }

            if(Transport === 'Yes'){
                await this.page.locator('#transport_indicator-true-0').check();
            }

            if(Transport === 'Yes'){
                await this.page.locator('#transport_indicator-false-1').check();
            }else{
                await this.page.locator('#transport_indicator-false-1').check();
            }

            //await this.page.pause();
            await this.page.getByRole('combobox', { name: 'Pick interest indicator' }).click();
            await this.page.getByRole('option', { name: InterestIndicator }).click();
            await this.page.getByRole('combobox', { name: 'Pick exit indicator' }).filter({ visible: true }).click();
            await this.page.getByRole('option', { name: ExitIndicator }).click();
            await this.page.getByRole('combobox', { name: 'Pick payment indicator' }).filter({ visible: true }).click();
            await this.page.getByRole('option', { name: PayIndicator }).click();
            await this.page.getByRole('combobox', { name: 'Pick account type' }).click();
            await this.page.getByRole('option', { name: AccType }).click();
            await this.page.getByRole('combobox', { name: 'Pick statement print' }).click();
            await this.page.getByRole('option', { name: StatementPrint }).click();
        }
    }

    async enterAccountInfo(accountNum: string, balanceIndicator?: string, productType?: string, investorsLoans?: string){
        if(this.accountType == "Cash accounts (Miscellaneous) (ZL)"){
            await this.page.getByRole('textbox').nth(3).click();
            await this.page.getByRole('textbox').nth(3).fill(accountNum[2]);
            await this.page.getByRole('textbox').nth(4).fill(accountNum[3]);
            await this.page.locator('input:nth-child(8)').fill(accountNum[7]);
            await this.page.locator('input:nth-child(9)').fill(accountNum[8]);
            await this.page.locator('input:nth-child(10)').fill(accountNum[9]);
        }

        else if(this.accountType == "Monthly accounts (Miscellaneous) (ZD and other Z accounts)"){
            await this.page.getByRole('textbox').nth(2).click();
            await this.page.getByRole('textbox').nth(2).fill(accountNum[0]);
            await this.page.getByRole('textbox').nth(2).fill(accountNum[1]);
            await this.page.getByRole('textbox').nth(3).fill(accountNum[2]);
            await this.page.getByRole('textbox').nth(4).fill(accountNum[3]);
            await this.page.getByRole('textbox').nth(5).fill(accountNum[4]);
            await this.page.locator('input[type="text"]').nth(5).fill(accountNum[5]);
            await this.page.locator('input:nth-child(7)').fill(accountNum[6]);
            await this.page.locator('input:nth-child(8)').fill(accountNum[7]);
            await this.page.locator('input:nth-child(9)').fill(accountNum[8]);
            await this.page.locator('input:nth-child(10)').fill(accountNum[9]);
        }

        else if(this.accountType == "Maise supply accounts (Production) (X)"){
            await this.page.getByRole('textbox', { name: 'Enter trail balance indicator' }).click();
            await this.page.getByRole('textbox', { name: 'Enter trail balance indicator' }).fill('12');
            await this.page.getByRole('combobox', { name: 'Select an investors loans' }).click();
            await this.page.getByRole('option', { name: 'No' }).click();

            //enter last 3 digits of the account number:
            await this.page.locator('input:nth-child(8)').fill(accountNum[7]);
            await this.page.locator('input:nth-child(9)').fill(accountNum[8]);
            await this.page.locator('input:nth-child(10)').fill(accountNum[9]);
        }

        else if(this.accountType == "Production and monthly accounts (Production) (A to S)"){
            await this.page.getByRole('textbox', { name: 'Enter trail balance indicator' }).click();
            await this.page.getByRole('textbox', { name: 'Enter trail balance indicator' }).fill(balanceIndicator || "");
            await this.page.getByRole('combobox', { name: 'Pick account type' }).click();
            await this.page.getByRole('option', { name: productType || "", exact: true }).click();

            await this.page.getByRole('combobox', { name: 'Select an investors loans' }).click();
            await this.page.getByRole('option', { name: investorsLoans || "" }).click();

            //enter account number only if the field is enabled
            if(await this.page.locator('input:nth-child(8)').isEnabled()){
                await this.page.locator('input:nth-child(8)').fill(accountNum[7]);
            }

            if(await this.page.locator('input:nth-child(9)').isEnabled()){
                await this.page.locator('input:nth-child(9)').fill(accountNum[8]);
            }

            if(await this.page.locator('input:nth-child(10)').isEnabled()){
                await this.page.locator('input:nth-child(10)').fill(accountNum[9]);
            }
        }
    }

    async saveClient(){
        await this.page.getByRole('dialog').getByRole('button', { name: 'Create Client' }).click();
        await this.page.getByRole('button', { name: 'Create', exact: true }).click(); 
        await expect(this.page.getByText('Success', { exact: true })).toBeVisible();
        await expect(this.page.getByText('Client created successfully', { exact: true })).toBeVisible();
    }

}



import { test as setup, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
require('dotenv').config();

// setup('authenticate', async ({ page }) => {

//     await page.goto('https://lar-qa.nwk.co.za/auth/sign-in');
//     //await page.goto('https://lar-qa.nwk.co.za/general/clients');

//     //await page.pause();
//     await page.waitForLoadState('networkidle');
//     await page.locator("#username").fill(process.env.QA_Username || "");

//     //await page.locator("#Password").fill(process.env.QA_Password || "");
//     await page.locator('#pv_id_0_11').fill(process.env.QA_Password || "");

//     await page.getByRole('button', { name: 'Login' }).click({timeout: 30000});

//     // Wait for dashboard iframe
    

//     // IMPORTANT:
//     // Wait until Clients system fully opens
//     //await page.waitForLoadState('networkidle');
//     await expect(page.locator('text=Welcome to NWK,')).toBeVisible({timeout: 30000});

//     //Triouble shoot the auth storage:
//     const authState = await page.evaluate(() =>  {
//         const authValue = sessionStorage.getItem('Auth');
        
//         if(!authValue){
//             return {exists: false};
//         }
        
//         try{
//             const auth = JSON.parse(authValue);
//             return{
//                 exists: true,
//                 userExists: !!auth.user,
//                 userProperties: auth.user ? Object.keys(auth.user) : [],
//                 permissionsCount: auth.permissions?.length ?? 0,
//                 accessTokenExists: !!sessionStorage.getItem('access_token')
//             }
//         }catch{
//             return {exists: true, validationJSON: false};
//         }
//     })

//     console.log('\n--- AUTHENTICATION STATE AFTER LOGIN (login file) ---', JSON.stringify(authState, null, 2));

//     // Save state AFTER navigation complete
//     await page.context().storageState({
//         path: 'tests/auth/storageState.json'
//     });
// });

setup('authenticate', async({page}) => {
    await page.goto('https://lar-qa.nwk.co.za/auth/sign-in');
    await page.waitForLoadState('networkidle');

    //enter credentials and log in:
    await page.locator("#username").fill(process.env.QA_Username || "");
    await page.locator('#pv_id_0_11').fill(process.env.QA_Password || "");

    await page.getByRole('button', { name: 'Login' }).click({timeout: 30000});
    await expect(page.locator('text=Welcome to NWK,')).toBeVisible({timeout: 30000});

    const sessionStorageData = await page.evaluate(() => {
        const data: Record<string, any> = {};

        for(let i = 0; i < sessionStorage.length; i++){
            const key = sessionStorage.key(i);
            if(key){
                const value = sessionStorage.getItem(key);

                if(value !== null){
                    data[key]  = value;
                }
            }
        }
        return data;
    });

    const sessionStoragePath = path.resolve(__dirname, 'sessionStorage.json');

    fs.writeFileSync(
        sessionStoragePath,
        JSON.stringify(sessionStorageData, null, 2)
    );
    console.log('Session storage saved successfully.');

    // 2. Save normal Playwright storage state (cookies + localStorage)
    const storageStatePath = path.resolve( __dirname,'storageState.json');
    await page.context().storageState({path: storageStatePath});
    console.log('Playwright storage state saved successfully.');

    // 3. Confirm authentication state before saving
    const authState = await page.evaluate(() => {
        const authValue = sessionStorage.getItem('Auth');

        if (!authValue) {return { exists: false };}

        try {
            const auth = JSON.parse(authValue);

            return {
                exists: true,
                userExists: !!auth.user,
                permissionsCount: auth.permissions?.length ?? 0,
                accessTokenExists: !!sessionStorage.getItem('access_token')
            };
        } catch {
            return {
                exists: true,
                validJSON: false
            };
        }
    });

    console.log(
        'Authentication state saved:',
        JSON.stringify(authState, null, 2)
    );

    // console.log('\n--- SESSION STORAGE DATA ---', JSON.stringify(sessionStorageData, null, 2));
})
import Debug from 'debug'
const debug = Debug('ankichampion:services:')

import express from 'express'
import { Formidable } from 'formidable'
import fs from 'fs'
import fetch from 'node-fetch';
import path from 'path'
import 'dotenv/config'
import { put } from '@vercel/blob'

export const runtime = 'edge';

const vercelService = {
    upload: async (filePath, directory = '1') => {
        // const filePath = './data/speech/abandon.mp3';
        const fileStream = fs.createReadStream(filePath);
        const fileName = path.basename(filePath);
        const uploadPath = path.join(directory, fileName);


        try {
            const { url } = await put(uploadPath, fileStream, { access: 'public' });
            console.log('File uploaded successfully:', url);
            return url
        } catch (error) {
            console.error('Error uploading the file:', error);
        }
    },
    fetchData: async (url) => {
      try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const contentType = response.headers.get('content-type');
        let data;
        if (contentType && contentType.includes('application/json')) {
            data = await response.json();
        } else {
            data = await response.text(); // 또는 다른 적절한 형식으로 처리
        }
        console.log('Data fetched successfully:', data);
        return data;
    } catch (error) {
        console.error('Error fetching the data:', error);
    }
  }    
}
export default vercelService
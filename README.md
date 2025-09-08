<div align="center" width="100%">
    <img src="./frontend/public/icon.svg" width="128" alt="" />
</div>

# Fork of Dockge

This is a fork of the excellent [Dockge](https://github.com/louislam/dockge) by [@louislam](https://github.com/louislam).  
Since I was missing some features and the project doesn’t seem to be actively maintained at the moment, I have implemented these features here in my fork.

For general information about Dockge, please refer to the original project.  
Details about my changes are available in the [release notes](https://github.com/hamphh/dockge/releases).

## Usage

To use this fork, replace `louislam/dockge:1` with `hamphh/dockge` in the [Dockge compose file](https://github.com/hamphh/dockge/blob/master/compose.yaml).  
The new image must be used on all endpoints.

⚠️ **Important:** Make a backup of your Dockge data folder beforehand or use a different one, as this image modifies the database.  

Currently, the image is built for **linux/amd64** and **linux/arm/v7**. Additional platforms can be added if needed.
---
title: "Running Python on Your Own Computer"
date: "2026-09-06"
author: Adam Vosburgh
sequence: 5
cat: resource
published: true
---

The tutorials use Google Colab because it needs nothing installed. If you would rather not depend on Google, or you want your notebooks and data to live on your own machine, here is how to set up the same environment locally. The code in the tutorials runs unchanged, apart from the upload cell: locally you just put the files in a `data/` folder next to the notebook and read them from there.

This is taken, with light edits, from the last tutorial of Methods in Spatial Research. It takes about half an hour the first time.

## Setting up your notebook

You will need a full-featured text editor. I recommend [VS Code](https://code.visualstudio.com/), and I'll assume you are using it in what follows.

Open Terminal on MacOS, or PowerShell on Windows. Run each of these commands by typing them in and hitting `enter`. Together they make a folder named `smt` on your desktop, open it, and create two empty files we'll need.

If you are new to this, [this quick start](https://www.macworld.com/article/221277/command-line-navigating-files-folders-mac-terminal.html) on navigating files in the terminal is worth ten minutes. If it's all too confusing, you are absolutely welcome to create the folder as you would any other folder, open it in VS Code, and make the files with the "new file" button in there.

**On MacOS:**

```bash
cd Desktop
mkdir smt
cd smt
touch tutorial-2.ipynb
touch environment.yml
code .
```

Most likely, that last command did not work for you. If it did, it would have opened VS Code at the folder you made. To make it work, follow [these instructions](https://code.visualstudio.com/docs/setup/mac#_launch-vs-code-from-the-command-line); I find it convenient. Otherwise open VS Code and use `File` > `Open Folder...`. On Windows, `code .` works by default.

**On Windows**, in PowerShell:

```powershell
cd Desktop
mkdir smt
cd smt
New-Item tutorial-2.ipynb
New-Item environment.yml
code .
```

One last thing: in VS Code, `Terminal` > `New Terminal` opens a terminal at the bottom of the window that is running in this folder. Going forward, that's where you type commands.

## Installing conda

The packages we use (`geopandas` in particular) depend on some native geospatial libraries (GDAL, PROJ) that are much more reliable to install through conda than through pip. So we'll use conda as the package manager.

Download the **Miniconda** installer from [anaconda.com/download](https://www.anaconda.com/download/success) and run it with the default settings. It's the smallest version that gives you what you need.

On MacOS, after it finishes, refresh your terminal:

```bash
source ~/.zshrc
```

Then check it worked:

```bash
conda --version
```

You should see a version number. Once that works, go on.

## Creating the environment

Paste this into the `environment.yml` file you made:

```yaml
name: smt
channels:
  - conda-forge
  - defaults
dependencies:
  - python
  - numpy
  - pandas
  - geopandas
  - rasterio
  - altair
  - matplotlib
  - ipykernel
```

`conda-forge` is listed first because it carries the most current geospatial builds. `ipykernel` is what lets VS Code run the notebook. `rasterio` is the one addition over the Methods version, for the land cover raster in Tutorial 2.

In the terminal:

```bash
conda env create -f environment.yml
```

This takes a few minutes the first time. Then:

```bash
conda activate smt
```

Your prompt changes to show `(smt)`. Register the environment as a notebook kernel so VS Code can find it:

```bash
python -m ipykernel install --user --name smt --display-name "smt"
```

You only do this once. Then open the `.ipynb` file in VS Code, click `Select Kernel` in the top right, choose `Jupyter Kernel...`, and pick **smt**. If it isn't listed, close and reopen VS Code.

That's the setup. In the tutorials, skip the `from google.colab import files` line and the upload cell, and change the paths from `/content/...` to `data/...`.

## If it breaks

If you have spent more than an hour on the environment and it still does not work, go back to Colab for this week and bring your laptop to office hours. Nothing in the class depends on running locally.

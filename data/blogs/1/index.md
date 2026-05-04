P1

Hi, My name is Li Xiangqian and my Supervisor is Dr. Sun Daner, The title of my thesis is “Video-Based Student Emotion Recognition and Teaching Quality Assessment in Smart Classroom Environments”



P2

this is my contents, *let me* **take you through it**



P3 

the first part is Background & motivation. why we want to Research this topic.

**There are three reasons**,

first is, **classrooms have grown** *bigger and more crowded*, **it's harder for teachers to monitor** every student in traditional ways.



Second is, **Disengagement** is one of the strongest predictor of dropout and poor academic outcomes



Third is, nowadays **cameras are already everywhere — the question is no longer whether to capture, but how to read**. 



P4 

now let's move on to the Dataset part。

in this paper we use DAiSEE DataSet, 

**This dataset is 15 GB in total**  

**it includes 9 hours of video**, 112 Students and 4-level labels. it very suitable for our research.



P5 

but when we visualize this Dataset we can see that, it's  **highly imbalanced** right, 



we can see that level 3 in boredom is only 2.9%, level 0 in engagement is **even smaller**, only 0.6%. and **Level 0 dominates in Confusion and Frustration — over 65% of all samples**



so the first **the first challenge before training** is **handling this imbalance**.



P6

**Before running experiments, we need to choose which models to compare**,

**In this thesis I compare a total of 12 models**

**five DL model, five ML model, and two precision settings of the same model**



P7 

**The five models I want to highlight are these deep learning model**

**Each one is taken from a recent paper in this area**. 

They span different backbones and different temporal modeling approaches，**and most important is, they cover a wide range of parameter scales**

the biggest have 64 M the smallest is only 0.49 M



P8

Now lets move to the experiment。

**my classification strategy went through five iterations**

first stage is Full 4-Level

second is Class-Balanced

third is Pure Binary

fourth is Hybrid 4+2

**and finally** is Improved Hybrid 

**Let me walk you through each one and explain why each was necessary**



P9 

At first I was perhaps a bit **over-optimistic**, i did no preprocessing on the data.

 and these were the results: Boredom, Confusion, and Frustration all **defaulted to Level 0**, while Engagement was **stuck at Level 2**.

If we look back at the dataset graph , the reason is clear: 

because the data is so imbalanced, the model only need **simply by picking the majority class** can get a high accuracy. In other words, the model became **'lazy'**.



P10 

To address this, **I give them different weights** to make labels more smoothly. However, the results **were still not good enough**. You can see, the accuracy for **'Confusion' and 'Frustration'** remained very low.



P11

Next, I tried **simplifying** the problem **to** a binary classification. While the **accuracy improved immediately**, we **lost a lot of detail** in the process. More importantly, the **recall rate** was still not where we wanted it to be.



P12 

So next, I tried a **hybrid approach**. For Boredom and Engagement, the data was more balanced, so I **kept** the 4-level classification. But for Confusion and Frustration, more than half of the data was Level 0, so I **changed** them to 2-level classification.

As you can see, the **recall** for Confusion and Frustration **improved a lot**. This was good, but I didn't stop there.



P13

Let’s look at this chart again. 

You can see that the **sample sizes** for Boredom Level 3 and Engagement Level 0 are very small. So, I **combined** Level 3 into Level 2 for Boredom, and Level 0 into Level 1 for Engagement. and i also keep level 3  and level 0 , to maintain 4-level classification

This **greatly improved** the accuracy for both Boredom and Engagement.



P14

Now that the data is ready, let's **move on** to the next part: **training** the models.



P15 

This slide shows the **experimental setup**. Most of these details **were mentioned** in the previous. So let us move to next.



P16

Now, let’s look at the **overall comparison**. This table **compares** 5 Deep Learning models with 5 Machine Learning models. 

As we can see, most DL models **significantly outperform** the ML ones.

Also, **VideoSwinEmotion** achieved the **highest accuracy**. Interestingly, although **OptShuffleNetV2** has **fewer parameters**, its accuracy is still better than those two models.

This proves that **more parameters don't always mean better performance**.



P17 

I also **visualized** the results in this graph. As you can see, **VideoSwinEmotion** is the best. Even though **OptShuffleNetV2** **parameter count** is small, the accuracy is still very high.



P18 

I also **created** this bar chart. As you can see, **DL models** are **much better** than ML models.



P19 

We also compared the **time consumption**. As you can see, **OptShuffleNetV2 is the fastest**, reaching almost **230 FPS**. Meanwhile, **VideoSwinEmotion** runs at **114 FPS**, which is still more than enough for a real-time system.



P20

My research makes the following **contributions**:

1. **Proposing** an **ultra-lightweight backbone** suitable for real-time applications.
2. **Developing** an original **Hybrid Labeling Strategy** to  smoothing data imbalance.
3. **Performing** an extensive **benchmarking study** involving 12 different DL and ML models.



P21

I have also **prepared** a short demo. For this demonstration, **I used a video from Bilibili** to test the system's performance.



P22

First, I use **YOLO** to **locate** the students' faces. Since I chose **VideoSwinEmotion**, I need to **process the video stream** as input to get the results.



P22

Once the inference is complete, the data is **visualized in real-time**, just like this



P23

Finally, let's talk about **Future Work**.

First, I want to create an **Active Learning Loop** by involving teachers in the **data relabeling** process.

Second, I plan to add **Multi-Modal Signals**. In the future, we won't just use face detection; we can also add **head pose** and **eye tracking**.

Lastly, I will focus on **Cross-Dataset Generalization** to make sure the model works well on different datasets.
